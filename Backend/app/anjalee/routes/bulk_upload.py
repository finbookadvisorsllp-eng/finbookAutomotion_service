import os
import asyncio
import uuid
import logging
import csv
import io
import openpyxl
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from bson import ObjectId
from app.db import get_async_db, MONGO_URI, DB_NAME
from app.anjalee.services.ocr_service import OcrService
from app.anjalee.services.llm_service import llm_service, document_ai_service, DOCUMENT_TYPES, dynamic_document_ai
from app.anjalee.services.document_validation import document_validation_service
from app.anjalee.services.layout_analyzer import layout_analyzer
from app.anjalee.services.extraction_agents import agent_orchestrator
from app.anjalee.services.validation_engine import validation_engine

logger = logging.getLogger("bulk_upload_router")
router = APIRouter(prefix="/bulk-upload", tags=["bulk-upload"])

UPLOAD_DIR = os.path.join("uploads", "bulk-upload")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Reusable service dependency
ocr_service = OcrService()

# Thread pool for running CPU-bound OCR without blocking async event loop
_ocr_executor = ThreadPoolExecutor(max_workers=2)


class OcrProcessRequest(BaseModel):
    upload_id: str


def _run_ocr_background(file_path: str, file_type: str, upload_id: str, mongo_uri: str, db_name: str):
    """
    Enterprise multi-stage OCR + AI pipeline.

    Stage 1  — Upload record (already created before this call)
    Stage 2  — Raw OCR: words, bboxes, confidence → saved to ocr_data collection
    Stage 3  — Layout analysis: header/footer/paragraphs/tables → saved to layouts collection
    Stage 4  — Agent-based AI extraction → saved to ai_extractions collection
    Stage 5  — Business validation → saved to validations collection

    bulk_uploads document is updated at every stage so the frontend progress
    bar continues to work without any changes.
    """
    import pymongo
    try:
        client = pymongo.MongoClient(mongo_uri)
        db = client[db_name]

        # ── STAGE 2: Raw OCR ───────────────────────────────────────────────────
        logger.info(f"[BG] Stage 2 — OCR starting for upload_id={upload_id}")
        db["bulk_uploads"].update_one(
            {"_id": ObjectId(upload_id)},
            {"$set": {"pipeline_stage": "ocr_running", "pipeline_progress": 10}}
        )

        ocr_result = ocr_service.process_document(file_path, file_type)

        # Save to bulk_uploads (keeps existing review UI working)
        db["bulk_uploads"].update_one(
            {"_id": ObjectId(upload_id)},
            {"$set": {
                "status": "OCR Done",
                "ocr_data": ocr_result,
                "ocr_error": None,
                "pipeline_stage": "ocr_complete",
                "pipeline_progress": 35
            }}
        )

        # Save to dedicated ocr_data collection (Stage 2)
        db["ocr_data"].update_one(
            {"document_id": ObjectId(upload_id)},
            {"$set": {
                "document_id":   ObjectId(upload_id),
                "pages":         ocr_result.get("pages", []),
                "page_count":    ocr_result.get("page_count", 0),
                "avg_confidence": ocr_result.get("avg_confidence", 0.0),
                "processing_time": ocr_result.get("processing_time", 0.0),
                "created_at":    datetime.utcnow(),
            }},
            upsert=True
        )
        logger.info(f"[BG] Stage 2 complete for upload_id={upload_id}")

        # Build full text for AI from all OCR pages
        pages = ocr_result.get("pages", [])
        full_text = "\n\n".join(
            f"[Page {p.get('page_number', i + 1)}]\n{p.get('text', '')}"
            for i, p in enumerate(pages)
            if p.get("text", "").strip()
        )

        # Save raw OCR text to a .txt file alongside the uploaded document
        try:
            txt_path = os.path.splitext(file_path)[0] + "_ocr.txt"
            with open(txt_path, "w", encoding="utf-8") as txt_file:
                txt_file.write(full_text)
            logger.info(f"[BG] OCR text saved to {txt_path}")
        except Exception as txt_err:
            logger.warning(f"[BG] Failed to save OCR text file (non-fatal): {txt_err}")

        # ── STAGE 3: Layout Analysis ───────────────────────────────────────────
        logger.info(f"[BG] Stage 3 — Layout analysis for upload_id={upload_id}")
        db["bulk_uploads"].update_one(
            {"_id": ObjectId(upload_id)},
            {"$set": {"pipeline_stage": "layout_running", "pipeline_progress": 45}}
        )
        try:
            layout_result = layout_analyzer.analyze_layout(ocr_result)
            db["layouts"].update_one(
                {"document_id": ObjectId(upload_id)},
                {"$set": {
                    "document_id": ObjectId(upload_id),
                    "pages":       layout_result.get("pages", []),
                    "created_at":  datetime.utcnow(),
                }},
                upsert=True
            )
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {"pipeline_stage": "layout_complete", "pipeline_progress": 55}}
            )
            logger.info(f"[BG] Stage 3 complete for upload_id={upload_id}")
        except Exception as le:
            logger.warning(f"[BG] Layout analysis failed (non-fatal): {le}")

        # ── Get company info for AI agents ─────────────────────────────────────
        company_name, company_gstin = "", ""
        record = db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
        if record:
            company_id = record.get("company_id")
            comp = None
            if company_id:
                if len(str(company_id)) == 24:
                    try:
                        comp = db["companies"].find_one({"_id": ObjectId(company_id)})
                    except Exception:
                        pass
                if not comp:
                    comp = db["companies"].find_one({
                        "$or": [
                            {"companyName": company_id},
                            {"basicCompantFormalName": company_id}
                        ]
                    })
            if not comp:
                comp = db["companies"].find_one()
            if comp:
                company_name = comp.get("companyName") or comp.get("basicCompantFormalName") or comp.get("name") or ""
                gst_details = comp.get("gstDetails")
                if isinstance(gst_details, dict):
                    company_gstin = gst_details.get("gstin") or ""
                elif isinstance(gst_details, str):
                    company_gstin = gst_details
                else:
                    company_gstin = comp.get("gstin") or ""

        if full_text.strip():
            # ── STAGE 4: AI Agent Extraction ──────────────────────────────────
            logger.info(f"[BG] Stage 4 — Agent extraction for upload_id={upload_id}")
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {"pipeline_stage": "ai_running", "pipeline_progress": 65}}
            )

            filename = (record or {}).get("filename", "") if record else ""
            schema = agent_orchestrator.extract(
                full_text,
                filename=filename,
                our_company_name=company_name,
                our_company_gstin=company_gstin,
                layout_result=layout_result if 'layout_result' in locals() else None
            )

            # Save to dedicated ai_extractions collection (Stage 4)
            db["ai_extractions"].update_one(
                {"document_id": ObjectId(upload_id)},
                {"$set": {
                    "document_id":   ObjectId(upload_id),
                    "schema":        schema,
                    "document_type": schema.get("document_type"),
                    "confidence":    schema.get("overall_confidence"),
                    "agent_results": schema.get("agent_results", {}),
                    "created_at":    datetime.utcnow(),
                }},
                upsert=True
            )
            logger.info(f"[BG] Stage 4 complete: doc_type={schema.get('document_type')} for upload_id={upload_id}")

            # ── STAGE 5: Business Validation ──────────────────────────────────
            logger.info(f"[BG] Stage 5 — Validation for upload_id={upload_id}")
            try:
                validation_result = validation_engine.validate(schema)
                db["validations"].update_one(
                    {"document_id": ObjectId(upload_id)},
                    {"$set": {
                        "document_id": ObjectId(upload_id),
                        **validation_result,
                        "created_at":  datetime.utcnow(),
                    }},
                    upsert=True
                )
                # Attach validation summary to schema for UI display
                schema["_validation"] = {
                    "status":        validation_result["status"],
                    "error_count":   validation_result["summary"]["error_count"],
                    "warning_count": validation_result["summary"]["warning_count"],
                    "errors":        validation_result["errors"],
                    "warnings":      validation_result["warnings"],
                }
                logger.info(f"[BG] Stage 5 complete: status={validation_result['status']} for upload_id={upload_id}")
            except Exception as ve:
                logger.warning(f"[BG] Validation failed (non-fatal): {ve}")

            doc_type = (schema.get("document_type") or "").lower()
            is_invoice_doc = "sales" in doc_type or "purchase" in doc_type

            inv_num = None
            supplier_gstin = None
            if is_invoice_doc:
                voucher_details = next((s for s in schema.get("sections", []) if s["id"] == "voucher_details"), None)
                if voucher_details:
                    inv_num = next((f["value"] for f in voucher_details.get("fields", []) if f["id"] == "invoice_number"), None)
                    supplier_gstin = next((f["value"] for f in voucher_details.get("fields", []) if "gstin" in f["id"]), None)

            if is_invoice_doc and inv_num and supplier_gstin:
                # Query db for another upload of same invoice
                existing_doc = db["bulk_uploads"].find_one({
                    "_id": {"$ne": ObjectId(upload_id)},
                    "status": "Ready For Review",
                    "dynamic_schema.sections.fields": {
                        "$elemMatch": {"id": "invoice_number", "value": inv_num}
                    },
                    "dynamic_schema.sections.fields": {
                        "$elemMatch": {"id": {"$regex": "gstin"}, "value": supplier_gstin}
                    }
                })
                if existing_doc:
                    logger.info(f"Continuation page detected. Merging upload_id={upload_id} into main_id={existing_doc['_id']}")
                    main_schema = existing_doc.get("dynamic_schema", {})
                    main_li_section = next((s for s in main_schema.get("sections", []) if s["id"] == "line_items"), None)
                    curr_li_section = next((s for s in schema.get("sections", []) if s["id"] == "line_items"), None)
                    if main_li_section and curr_li_section:
                        main_table = next((f for f in main_li_section.get("fields", []) if f["type"] == "table"), None)
                        curr_table = next((f for f in curr_li_section.get("fields", []) if f["type"] == "table"), None)
                        if main_table and curr_table:
                            main_table["rows"].extend(curr_table.get("rows", []))
                            # Update existing document schema in database
                            db["bulk_uploads"].update_one(
                                {"_id": existing_doc["_id"]},
                                {"$set": {"dynamic_schema": main_schema}}
                            )
                            # Mark current upload as Merged
                            db["bulk_uploads"].update_one(
                                {"_id": ObjectId(upload_id)},
                                {"$set": {
                                    "status": "Merged",
                                    "merged_into": existing_doc["_id"],
                                    "pipeline_stage": "merged",
                                    "pipeline_progress": 100
                                }}
                            )
                            logger.info(f"Merged successfully. Main items count={len(main_table['rows'])}")
                            return

            # Update bulk_uploads with final schema (keeps review UI working)
            final_status = "Ready For Review"
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {
                    "status":            final_status,
                    "dynamic_schema":    schema,
                    "pipeline_stage":    "ai_complete",
                    "pipeline_progress": 100
                }}
            )
            logger.info(f"[BG] All stages complete for upload_id={upload_id}")
        else:
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {"status": "Missing Information", "pipeline_stage": "failed", "pipeline_progress": 0}}
            )
            logger.warning(f"[BG] OCR text is empty for upload_id={upload_id}")

    except Exception as e:
        logger.error(f"[BG] OCR/AI pipeline failed for upload_id={upload_id}: {e}", exc_info=True)
        try:
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {"status": "Failed", "ocr_error": str(e), "pipeline_stage": "failed", "pipeline_progress": 0}}
            )
        except Exception:
            pass
    finally:
        try:
            client.close()
        except Exception:
            pass


@router.post("/upload", response_model=dict)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    force_replace: bool = Form(False),
    source: str = Form("Manual Upload"),
    db = Depends(get_async_db)
):
    """
    Saves an uploaded PDF or image file, performs validations (corruption, protection),
    runs hash duplicate checks, executes Quality checks (blur, resolution, handwriting),
    and saves complete validation metadata.
    """
    orig_name = file.filename or "unnamed_file"
    ext = orig_name.split('.').pop().lower()

    if ext not in ["pdf", "png", "jpg", "jpeg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: .{ext}. Supported formats are PDF, PNG, JPG, and JPEG."
        )

    try:
        # Save file to temp path first to perform validations
        unique_name = f"{uuid.uuid4()}_{orig_name}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)

        # 1. Basic checks (empty, password, corrupted)
        basic_res = document_validation_service.validate_file_basic(file_path, orig_name)
        if not basic_res.get("valid"):
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=basic_res.get("reason", "Invalid file uploaded.")
            )

        # 2. Hash generation and Duplicate checking
        file_hash = document_validation_service.calculate_file_hash(file_path)
        existing = await db["bulk_uploads"].find_one({"file_hash": file_hash})

        if existing and not force_replace:
            # Check if the duplicate record has the new flat schema keys
            dynamic_schema = existing.get("dynamic_schema") or {}
            has_flat_keys = "voucherNumber" in dynamic_schema or "partyLedger" in dynamic_schema
            
            if not has_flat_keys:
                logger.info(f"Duplicate file found but lacks flat schema keys. Triggering background re-run for upload_id={existing['_id']}")
                await db["bulk_uploads"].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"status": "Processing", "pipeline_stage": "ocr_running", "pipeline_progress": 10}}
                )
                loop = asyncio.get_event_loop()
                loop.run_in_executor(
                    _ocr_executor,
                    _run_ocr_background,
                    existing["file_path"],
                    existing["file_type"],
                    str(existing["_id"]),
                    MONGO_URI,
                    DB_NAME
                )
                if os.path.exists(file_path):
                    os.remove(file_path)
                return {
                    "success": True,
                    "duplicate_found": False,
                    "upload_id": str(existing["_id"]),
                    "filename": existing["filename"],
                    "file_type": existing["file_type"],
                    "file_hash": file_hash,
                    "quality_check": existing.get("quality_check"),
                    "page_validation": existing.get("page_validation")
                }

            if os.path.exists(file_path):
                os.remove(file_path)
            return {
                "success": True,
                "duplicate_found": True,
                "existing_doc": {
                    "id": str(existing["_id"]),
                    "filename": existing["filename"],
                    "uploaded_by": existing.get("uploaded_by", "Anjal Singh (You)"),
                    "uploaded_on": existing.get("upload_date").isoformat() if existing.get("upload_date") else None,
                    "status": existing.get("status", "Uploaded")
                }
            }

        # If duplicate and force_replace is selected, clean up old record
        if existing and force_replace:
            old_path = existing.get("file_path")
            if old_path and os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    logger.error(f"Failed to remove replaced file {old_path}: {e}")
            await db["bulk_uploads"].delete_one({"_id": existing["_id"]})

        # 3. Quality & Page check validations
        file_type = "pdf" if ext == "pdf" else "image"
        val_res = document_validation_service.check_quality_and_pages(file_path, file_type == 'pdf')

        company_id = request.headers.get("x-company-id") or request.headers.get("x-company")

        # 4. Save metadata record with status=Processing
        doc_record = {
            "filename": orig_name,
            "file_path": file_path,
            "file_type": file_type,
            "file_hash": file_hash,
            "upload_date": datetime.utcnow(),
            "uploaded_by": "Anjal Singh (You)",
            "status": "Processing",
            "quality_check": val_res["quality"],
            "page_validation": val_res["pages"],
            "ocr_data": None,
            "ocr_error": None,
            "company_id": company_id,
            "source": source
        }

        result = await db["bulk_uploads"].insert_one(doc_record)
        upload_id = str(result.inserted_id)

        # Trigger background OCR + AI analysis immediately
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            _ocr_executor,
            _run_ocr_background,
            file_path,
            file_type,
            upload_id,
            MONGO_URI,
            DB_NAME
        )

        logger.info(f"File {orig_name} saved and triggered background pipeline with ID: {upload_id}")
        return {
            "success": True,
            "duplicate_found": False,
            "upload_id": upload_id,
            "filename": orig_name,
            "file_type": file_type,
            "file_hash": file_hash,
            "quality_check": val_res["quality"],
            "page_validation": val_res["pages"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process file upload: {e}")
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and save file: {str(e)}"
        )


@router.get("/ocr/progress/{upload_id}", response_model=dict)
async def get_ocr_progress(
    upload_id: str,
    db = Depends(get_async_db)
):
    """
    Lightweight polling endpoint for real-time pipeline progress.
    Returns the current stage, % progress, and available data so far.
    The frontend polls this every 2 seconds to progressively fill the review UI.
    Stages: processing | ocr_running | ocr_complete | ai_running | ai_complete | failed
    """
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one(
        {"_id": ObjectId(upload_id)},
        # Only fetch the fields we need — faster query
        {"status": 1, "pipeline_stage": 1, "pipeline_progress": 1,
         "dynamic_schema": 1, "ocr_error": 1, "filename": 1}
    )
    if not record:
        raise HTTPException(status_code=404, detail=f"Upload ID {upload_id} not found.")

    stage = record.get("pipeline_stage")
    db_status = record.get("status", "Processing")
    dynamic_schema = record.get("dynamic_schema")
    dynamic_draft = record.get("dynamic_draft")
    if dynamic_schema and dynamic_draft and "sections" in dynamic_draft:
        dynamic_schema = {**dynamic_schema, "sections": dynamic_draft["sections"]}
        if dynamic_draft.get("document_type"):
            dynamic_schema["document_type"] = dynamic_draft["document_type"]

    # For documents processed before this update, infer stage from status + dynamic_schema presence
    if not stage:
        if db_status in ("Ready For Review", "AI Analyzed", "Validated", "Draft Saved") and dynamic_schema:
            stage = "ai_complete"
        elif db_status in ("OCR Done",):
            stage = "ocr_complete"
        elif db_status == "Failed":
            stage = "failed"
        else:
            stage = "processing"

    progress = record.get("pipeline_progress")
    if progress is None:
        stage_progress_map = {
            "processing": 5, "ocr_running": 30, "ocr_complete": 55,
            "ai_running": 75, "ai_complete": 100, "failed": 0
        }
        progress = stage_progress_map.get(stage, 0)

    # Build stage label map for the frontend progress steps
    stage_labels = {
        "processing":   "Uploading & validating document...",
        "ocr_running":  "Reading document with OCR...",
        "ocr_complete": "OCR complete. Starting AI analysis...",
        "ai_running":   "AI is extracting accounting fields...",
        "ai_complete":  "Extraction complete!",
        "failed":       "Processing failed.",
    }

    return {
        "success": True,
        "upload_id": upload_id,
        "stage": stage,
        "progress": progress,
        "stage_label": stage_labels.get(stage, "Processing..."),
        "status": db_status,
        "ocr_done": stage in ("ocr_complete", "ai_running", "ai_complete"),
        "ai_done": stage == "ai_complete",
        "dynamic_schema": dynamic_schema,  # None until ai_complete
        "error": record.get("ocr_error") if stage == "failed" else None,
    }


@router.post("/ocr/process", response_model=dict)
async def process_ocr(
    payload: OcrProcessRequest,
    db = Depends(get_async_db)
):
    """
    Starts OCR processing for the given upload_id in a background thread.
    Returns immediately with status="processing". Poll /ocr/status/{upload_id} for results.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload_id format."
        )

    # Fetch metadata record from MongoDB
    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload file with ID {upload_id} not found."
        )

    # Return cached result if OCR already completed
    if record.get("ocr_data") is not None:
        logger.info(f"Returning cached OCR results for file ID: {upload_id}")
        return {
            "success": True,
            "status": "done",
            "upload_id": upload_id,
            "data": record["ocr_data"]
        }

    # If already processing (another request started it), just say processing
    if record.get("status") == "Processing":
        return {
            "success": True,
            "status": "processing",
            "upload_id": upload_id,
            "data": None
        }

    file_path = record["file_path"]
    file_type = record["file_type"]

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file could not be found on the server storage."
        )

    # Mark as processing
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"status": "Processing"}}
    )

    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _ocr_executor,
        _run_ocr_background,
        file_path,
        file_type,
        upload_id,
        MONGO_URI,
        DB_NAME
    )

    logger.info(f"OCR background task started for upload_id={upload_id}")
    return {
        "success": True,
        "status": "processing",
        "upload_id": upload_id,
        "data": None
    }


@router.get("/ocr/status/{upload_id}", response_model=dict)
async def get_ocr_status(
    upload_id: str,
    db = Depends(get_async_db)
):
    """
    Poll this endpoint to check if OCR has completed for the given upload_id.
    Returns status: 'processing' | 'done' | 'failed'
    """
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload_id format."
        )

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload ID {upload_id} not found."
        )

    db_status = record.get("status", "Uploaded")
    ocr_data = record.get("ocr_data")
    ocr_error = record.get("ocr_error")

    if ocr_data is not None:
        return {"success": True, "status": "done", "upload_id": upload_id, "data": ocr_data}
    elif db_status == "Failed":
        return {"success": False, "status": "failed", "upload_id": upload_id, "error": ocr_error, "data": None}
    else:
        return {"success": True, "status": "processing", "upload_id": upload_id, "data": None}


class OcrExtractRequest(BaseModel):
    upload_id: str


@router.post("/ocr/extract", response_model=dict)
async def extract_ocr_fields(
    payload: OcrExtractRequest,
    db = Depends(get_async_db)
):
    """
    Runs LLM-based structured field extraction on already-OCR'd document text.
    Reads the stored ocr_data from MongoDB, concatenates all page text, sends it
    to the LLM, and returns structured invoice fields.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload_id format."
        )

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload ID {upload_id} not found."
        )

    ocr_data = record.get("ocr_data")
    if not ocr_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OCR has not been run yet for this document. Run /ocr/process first."
        )

    # Concatenate all page texts into one string for the LLM
    pages = ocr_data.get("pages", [])
    full_text = "\n\n".join(
        f"[Page {p.get('page_number', i+1)}]\n{p.get('text', '')}"
        for i, p in enumerate(pages)
        if p.get("text", "").strip()
    )

    if not full_text.strip():
        return {
            "success": False,
            "upload_id": upload_id,
            "message": "No text was extracted by OCR. Cannot perform field extraction.",
            "fields": {}
        }

    logger.info(f"Running LLM field extraction for upload_id={upload_id}")

    # Run LLM extraction in thread pool to avoid blocking the async event loop
    loop = asyncio.get_event_loop()
    extracted_fields = await loop.run_in_executor(
        _ocr_executor,
        llm_service.extract_document_fields,
        full_text
    )

    logger.info(f"LLM extracted fields for upload_id={upload_id}: {extracted_fields}")

    # Persist extracted fields to MongoDB for future reference
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"extracted_fields": extracted_fields}}
    )

    return {
        "success": True,
        "upload_id": upload_id,
        "fields": extracted_fields
    }


# ═══════════════════════════════════════════════════════════
# PHASE 3 — Document Classification
# ═══════════════════════════════════════════════════════════

class AiClassifyRequest(BaseModel):
    upload_id: str


@router.post("/ai/classify", response_model=dict)
async def ai_classify(
    payload: AiClassifyRequest,
    db = Depends(get_async_db)
):
    """
    Phase 3: Classifies the document type using OCR text.
    Saves result as classification_result in MongoDB.
    Returns: { document_type, confidence, reasoning }
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found.")

    # Return cached result if already classified
    if record.get("classification_result"):
        logger.info(f"Returning cached classification for upload_id={upload_id}")
        return {"success": True, "upload_id": upload_id, "cached": True, **record["classification_result"]}

    ocr_data = record.get("ocr_data")
    if not ocr_data:
        raise HTTPException(status_code=400, detail="OCR has not been run yet. Run /ocr/process first.")

    pages = ocr_data.get("pages", [])
    full_text = "\n\n".join(
        f"[Page {p.get('page_number', i+1)}]\n{p.get('text', '')}"
        for i, p in enumerate(pages)
        if p.get("text", "").strip()
    )

    if not full_text.strip():
        return {"success": False, "upload_id": upload_id, "document_type": "Unknown Document", "confidence": 0}

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        _ocr_executor,
        document_ai_service.classify_document,
        full_text
    )

    # Save — never overwrites ocr_data
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {
            "classification_result": {
                **result,
                "classified_at": datetime.utcnow().isoformat(),
                "available_types": DOCUMENT_TYPES
            }
        }}
    )

    logger.info(f"Classification complete for upload_id={upload_id}: {result.get('document_type')}")
    return {"success": True, "upload_id": upload_id, "cached": False, **result}


# ═══════════════════════════════════════════════════════════
# PHASE 4 — Full Accounting Data Extraction
# ═══════════════════════════════════════════════════════════

class AiExtractFullRequest(BaseModel):
    upload_id: str
    document_type: str | None = None   # optional override; uses classification_result if not provided
    force_rerun: bool = False


@router.post("/ai/extract-full", response_model=dict)
async def ai_extract_full(
    payload: AiExtractFullRequest,
    db = Depends(get_async_db)
):
    """
    Phase 4: Full structured accounting data extraction using LLM.
    Saves result as ai_extracted_json in MongoDB (separate from classification_result and ocr_data).
    Returns complete JSON with header, items[], totals, additionalFields, suggestions, confidence.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found.")

    # Return cached result unless force_rerun
    if record.get("ai_extracted_json") and not payload.force_rerun:
        logger.info(f"Returning cached ai_extracted_json for upload_id={upload_id}")
        return {
            "success": True,
            "upload_id": upload_id,
            "cached": True,
            "data": record["ai_extracted_json"]
        }

    ocr_data = record.get("ocr_data")
    if not ocr_data:
        raise HTTPException(status_code=400, detail="OCR has not been run yet.")

    pages = ocr_data.get("pages", [])
    full_text = "\n\n".join(
        f"[Page {p.get('page_number', i+1)}]\n{p.get('text', '')}"
        for i, p in enumerate(pages)
        if p.get("text", "").strip()
    )

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No OCR text available for extraction.")

    # Determine document type
    doc_type = payload.document_type
    if not doc_type:
        classification = record.get("classification_result", {})
        doc_type = classification.get("document_type", "Unknown Document")

    loop = asyncio.get_event_loop()
    extracted = await loop.run_in_executor(
        _ocr_executor,
        document_ai_service.extract_full_accounting_data,
        full_text,
        doc_type
    )

    # Enrich with metadata
    extracted["_meta"] = {
        "document_type": doc_type,
        "extracted_at": datetime.utcnow().isoformat(),
        "ocr_page_count": ocr_data.get("page_count", 1),
        "ocr_processing_time": ocr_data.get("processing_time", 0),
        "upload_filename": record.get("filename", "")
    }

    # Save — never overwrites ocr_data or classification_result
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"ai_extracted_json": extracted, "status": "AI Extracted"}}
    )

    logger.info(f"Full extraction complete for upload_id={upload_id}, confidence={extracted.get('overallConfidence')}")
    return {"success": True, "upload_id": upload_id, "cached": False, "data": extracted}


# ═══════════════════════════════════════════════════════════
# PHASE 5 — Save Draft (user-edited form)
# ═══════════════════════════════════════════════════════════

class AiSaveDraftRequest(BaseModel):
    upload_id: str
    edited_data: dict         # Full edited JSON (header, items, totals, etc.)
    document_type: str | None = None
    editor: str | None = "User"


@router.post("/ai/save-draft", response_model=dict)
async def ai_save_draft(
    payload: AiSaveDraftRequest,
    db = Depends(get_async_db)
):
    """
    Phase 5: Saves the user-edited accounting data as edited_json.
    Maintains a full edit_history — never overwrites ai_extracted_json or ocr_data.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found.")

    now = datetime.utcnow().isoformat()

    # Build history entry
    history_entry = {
        "timestamp": now,
        "editor": payload.editor or "User",
        "stage": "user_edit",
        "snapshot": payload.edited_data
    }

    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {
            "$set": {
                "edited_json": {
                    **payload.edited_data,
                    "_meta": {
                        "saved_at": now,
                        "editor": payload.editor,
                        "document_type": payload.document_type
                    }
                },
                "status": "Draft Saved"
            },
            "$push": {"edit_history": history_entry}
        }
    )

    logger.info(f"Draft saved for upload_id={upload_id} by {payload.editor}")
    return {"success": True, "upload_id": upload_id, "saved_at": now}


@router.get("/ai/history/{upload_id}", response_model=dict)
async def get_edit_history(
    upload_id: str,
    db = Depends(get_async_db)
):
    """Returns the full pipeline history for a document (ocr → classification → extraction → edits)."""
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Upload not found.")

    return {
        "success": True,
        "upload_id": upload_id,
        "filename": record.get("filename"),
        "status": record.get("status"),
        "ocr_at": record.get("ocr_data", {}).get("processing_time") if record.get("ocr_data") else None,
        "classified_at": record.get("classification_result", {}).get("classified_at"),
        "extracted_at": record.get("ai_extracted_json", {}).get("_meta", {}).get("extracted_at"),
        "draft_saved_at": record.get("edited_json", {}).get("_meta", {}).get("saved_at"),
        "edit_history": record.get("edit_history", []),
        "document_type": record.get("classification_result", {}).get("document_type", "Unknown")
    }


@router.get("/ai/document-types", response_model=dict)
async def get_document_types():
    """Returns the list of supported document types for the frontend classifier dropdown."""
    return {"success": True, "types": DOCUMENT_TYPES}


# ══════════════════════════════════════════════════════════
# DYNAMIC DOCUMENT UNDERSTANDING ENGINE  — POST /ai/analyze
# Single endpoint. Replaces /ai/classify + /ai/extract-full.
# Returns a complete dynamic form schema for ANY document type.
# The frontend renders the schema directly — no hardcoded forms.
# ══════════════════════════════════════════════════════════

class AiAnalyzeRequest(BaseModel):
    upload_id: str
    force_rerun: bool = False


@router.post("/ai/analyze", response_model=dict)
async def ai_analyze(
    request: Request,
    payload: AiAnalyzeRequest,
    db = Depends(get_async_db)
):
    """
    THE MAIN AI ENDPOINT for the Dynamic Document Understanding Engine.

    Workflow:
      1. Verify upload exists
      2. Check OCR is complete (returns 400 if not yet run)
      3. Return cached dynamic_schema if already analyzed and not force_rerun
      4. Call DynamicDocumentAI.generate_dynamic_schema(ocr_text)
      5. Save result as 'dynamic_schema' in MongoDB
      6. Return complete schema

    The schema contains sections[], each with fields[] of varying types.
    The React frontend renders the schema directly with zero hardcoded fields.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found.")

    # Return cached schema unless force_rerun
    if record.get("dynamic_schema") and not payload.force_rerun:
        cached_schema = record["dynamic_schema"]
        has_flat_keys = "voucherNumber" in cached_schema or "partyLedger" in cached_schema
        if has_flat_keys:
            logger.info(f"ai_analyze: returning cached dynamic_schema for {upload_id}")
            return {
                "success": True,
                "upload_id": upload_id,
                "cached": True,
                "schema": record["dynamic_schema"]
            }
        else:
            logger.info(f"ai_analyze: cached schema lacks flat keys. Re-running analysis for {upload_id}")

    # Ensure OCR is complete
    ocr_data = record.get("ocr_data")
    if not ocr_data:
        raise HTTPException(
            status_code=400,
            detail="OCR has not been completed. Call /ocr/process and wait for it to finish before calling /ai/analyze."
        )

    # Build full text from all OCR pages
    pages = ocr_data.get("pages", [])
    full_text = "\n\n".join(
        f"[Page {p.get('page_number', i + 1)}]\n{p.get('text', '')}"
        for i, p in enumerate(pages)
        if p.get("text", "").strip()
    )

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="OCR text is empty. Cannot analyze document.")

    # Get company details dynamically
    company_id = request.headers.get("x-company-id") or request.headers.get("x-company") or str(record.get("company_id") or "")
    comp = None
    if company_id:
        if len(str(company_id)) == 24:
            try:
                comp = await db["companies"].find_one({"_id": ObjectId(company_id)})
            except Exception:
                pass
        if not comp:
            comp = await db["companies"].find_one({
                "$or": [
                    {"companyName": company_id},
                    {"basicCompantFormalName": company_id}
                ]
            })
    if not comp:
        comp = await db["companies"].find_one()

    company_name, company_gstin = "", ""
    if comp:
        company_name = comp.get("companyName") or comp.get("basicCompantFormalName") or comp.get("name") or ""
        gst_details = comp.get("gstDetails")
        if isinstance(gst_details, dict):
            company_gstin = gst_details.get("gstin") or ""
        elif isinstance(gst_details, str):
            company_gstin = gst_details
        else:
            company_gstin = comp.get("gstin") or ""

    # Run AI schema generation in thread pool (CPU/IO bound)
    loop = asyncio.get_event_loop()
    schema = await loop.run_in_executor(
        _ocr_executor,
        dynamic_document_ai.generate_dynamic_schema,
        full_text,
        company_name,
        company_gstin,
        record.get("filename", "")
    )

    # Enrich with metadata
    schema["_meta"] = {
        "analyzed_at": datetime.utcnow().isoformat(),
        "upload_filename": record.get("filename", ""),
        "ocr_page_count": ocr_data.get("page_count", 1),
        "upload_id": upload_id,
    }

    # Persist — never touches ocr_data, classification_result, or ai_extracted_json
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {
            "dynamic_schema": schema,
            "status": "AI Analyzed"
        }}
    )

    logger.info(
        f"ai_analyze complete: upload_id={upload_id}, "
        f"doc_type={schema.get('document_type')}, "
        f"sections={len(schema.get('sections', []))}, "
        f"confidence={schema.get('overall_confidence')}"
    )

    return {
        "success": True,
        "upload_id": upload_id,
        "cached": False,
        "schema": schema
    }


# ══════════════════════════════════════════════════════════
# SAVE DYNAMIC DRAFT
# ══════════════════════════════════════════════════════════

class DynamicSaveDraftRequest(BaseModel):
    upload_id: str
    edited_sections: list      # The full edited sections array from frontend
    document_type: str | None = None
    editor: str | None = "User"


@router.post("/ai/save-dynamic-draft", response_model=dict)
async def save_dynamic_draft(
    payload: DynamicSaveDraftRequest,
    db = Depends(get_async_db)
):
    """
    Saves user edits to the dynamic schema form.
    Stores edited_sections separately as 'dynamic_draft' — never overwrites dynamic_schema or ocr_data.
    Maintains full edit_history.
    """
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Upload not found.")

    now = datetime.utcnow().isoformat()
    history_entry = {
        "timestamp": now,
        "editor": payload.editor or "User",
        "stage": "dynamic_form_edit",
        "document_type": payload.document_type,
        "section_count": len(payload.edited_sections)
    }

    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {
            "$set": {
                "dynamic_draft": {
                    "sections": payload.edited_sections,
                    "document_type": payload.document_type,
                    "saved_at": now,
                    "editor": payload.editor
                },
                "status": "Draft Saved"
            },
            "$push": {"edit_history": history_entry}
        }
    )

    logger.info(f"dynamic_draft saved: upload_id={upload_id}, sections={len(payload.edited_sections)}")
    return {"success": True, "upload_id": upload_id, "saved_at": now}


@router.get("/file/{upload_id}")
async def serve_uploaded_file(
    upload_id: str,
    db = Depends(get_async_db)
):
    """
    Serves the raw PDF or image file from storage for persistent frontend display.
    """
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail="File upload record not found.")

    file_path = record.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found in storage.")

    filename = record.get("filename", "document")
    ext = filename.split('.').pop().lower()
    media_type = "application/pdf" if ext == "pdf" else f"image/{ext}"

    headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
    return FileResponse(file_path, media_type=media_type, headers=headers)


@router.get("", response_model=dict)
async def list_uploads(
    db = Depends(get_async_db)
):
    """
    Lists all bulk uploads from database.
    """
    try:
        cursor = db["bulk_uploads"].find().sort("upload_date", -1)
        records = await cursor.to_list(length=100)
        
        uploads = []
        for r in records:
            file_url = f"/bulk-upload/file/{str(r['_id'])}"
            # Handle size conversion safely
            file_size = "2.4 MB"
            file_path = r.get("file_path")
            if file_path and os.path.exists(file_path):
                sz = os.path.getsize(file_path)
                if sz > 1024 * 1024:
                    file_size = f"{sz / (1024 * 1024):.1f} MB"
                else:
                    file_size = f"{sz / 1024:.0f} KB"

            uploads.append({
                "id": str(r["_id"]),
                "uploadId": str(r["_id"]),
                "name": r.get("filename", "Unnamed Document"),
                "source": r.get("source", "Manual Upload"),
                "type": r.get("document_type") or r.get("dynamic_schema", {}).get("document_type") or "Unknown",
                "category": r.get("category", "Financial"),
                "uploadedBy": r.get("uploaded_by", "Anjal Singh (You)"),
                "uploadedOn": r.get("upload_date").strftime("%d-%m-%Y, %I:%M %p") if r.get("upload_date") else "",
                "size": file_size,
                "status": r.get("status", "Uploaded"),
                "confidence": r.get("confidence") or r.get("dynamic_schema", {}).get("confidence") or 95,
                "fileUrl": file_url,
                "dynamic_schema": r.get("dynamic_schema")
            })
        return {"success": True, "documents": uploads}
    except Exception as e:
        logger.error(f"Failed to list uploads: {e}")
        return {"success": False, "error": str(e)}


@router.get("/{upload_id}", response_model=dict)
async def get_upload_detail(
    upload_id: str,
    db = Depends(get_async_db)
):
    """
    Retrieves the detailed metadata and dynamic_schema for a single upload record.
    """
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id format.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Upload record not found.")

    # Convert to frontend document format
    file_size = "2.4 MB"
    file_path = record.get("file_path")
    if file_path and os.path.exists(file_path):
        sz = os.path.getsize(file_path)
        if sz > 1024 * 1024:
            file_size = f"{sz / (1024 * 1024):.1f} MB"
        else:
            file_size = f"{sz / 1024:.0f} KB"

    dynamic_schema = record.get("dynamic_schema")
    dynamic_draft = record.get("dynamic_draft")
    if dynamic_schema and dynamic_draft and "sections" in dynamic_draft:
        dynamic_schema = {**dynamic_schema, "sections": dynamic_draft["sections"]}
        if dynamic_draft.get("document_type"):
            dynamic_schema["document_type"] = dynamic_draft["document_type"]

    doc = {
        "id": str(record["_id"]),
        "uploadId": str(record["_id"]),
        "name": record.get("filename", "Unnamed Document"),
        "source": record.get("source", "Manual Upload"),
        "type": record.get("document_type") or (dynamic_schema or {}).get("document_type") or "Unknown",
        "category": record.get("category", "Financial"),
        "uploadedBy": record.get("uploaded_by", "Anjal Singh (You)"),
        "uploadedOn": record.get("upload_date").strftime("%d-%m-%Y, %I:%M %p") if record.get("upload_date") else "",
        "size": file_size,
        "status": record.get("status", "Uploaded"),
        "confidence": record.get("confidence") or (dynamic_schema or {}).get("confidence") or 95,
        "fileUrl": f"/bulk-upload/file/{str(record['_id'])}",
        "dynamic_schema": dynamic_schema
    }
    return {"success": True, "document": doc}


@router.delete("/{upload_id}", response_model=dict)
async def delete_upload(
    upload_id: str,
    db = Depends(get_async_db)
):
    """
    Deletes an upload record and its physical file from disk.
    """
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id.")

    record = await db["bulk_uploads"].find_one({"_id": ObjectId(upload_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Upload record not found.")

    file_path = record.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"Failed to delete physical file {file_path}: {e}")

    await db["bulk_uploads"].delete_one({"_id": ObjectId(upload_id)})
    
    # Delete related documents from other collections to maintain DB hygiene
    for coll_name in ["ocr_data", "layouts", "ai_extractions", "validations"]:
        try:
            await db[coll_name].delete_many({"document_id": ObjectId(upload_id)})
        except Exception as e:
            logger.error(f"Failed to delete related documents from {coll_name} for upload_id {upload_id}: {e}")

    logger.info(f"Deleted upload record: {upload_id} and related collection documents.")
    return {"success": True, "detail": "Upload deleted successfully."}


class UpdateStatusRequest(BaseModel):
    upload_id: str
    status: str


@router.post("/status", response_model=dict)
async def update_bulk_upload_status(
    payload: UpdateStatusRequest,
    db = Depends(get_async_db)
):
    """Updates the status of a bulk upload document."""
    upload_id = payload.upload_id
    if not ObjectId.is_valid(upload_id):
        raise HTTPException(status_code=400, detail="Invalid upload_id.")
    
    await db["bulk_uploads"].update_one(
        {"_id": ObjectId(upload_id)},
        {"$set": {"status": payload.status}}
    )
    return {"success": True, "upload_id": upload_id, "status": payload.status}


@router.post("/analyze-spreadsheet", response_model=dict)
async def analyze_spreadsheet(
    file: UploadFile = File(...),
    db = Depends(get_async_db)
):
    """
    Full accounting-grade AI validation engine for bulk Excel/CSV uploads.

    Parses the uploaded file, classifies the document type, maps all columns to
    standard ERP fields, and runs 25+ validation categories against MongoDB master
    records (ledgers, stock items, banks, HSN codes, voucher duplicates, company
    financial year) using SpreadsheetValidationEngine.

    Returns structured ValidationIssue objects with row/col indices, confidence
    scores, suggested values, canAutoFix flags, and a complete validation summary.
    """
    from app.anjalee.services.spreadsheet_validator import SpreadsheetValidationEngine

    filename = file.filename or "spreadsheet.xlsx"
    contents = await file.read()
    ext = filename.rsplit('.', 1)[-1].lower()

    rows = []

    if ext == 'csv':
        try:
            decoded = contents.decode('utf-8-sig', errors='ignore')
            reader = csv.reader(io.StringIO(decoded))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
    elif ext in ('xlsx', 'xls'):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            for r in sheet.iter_rows(values_only=True):
                row_vals = []
                for x in r:
                    if x is None:
                        row_vals.append("")
                    elif isinstance(x, (datetime, date)):
                        row_vals.append(x)  # preserve datetime objects for accurate parsing
                    else:
                        row_vals.append(str(x))
                rows.append(row_vals)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: .{ext}. Use .xlsx, .xls or .csv")

    if not rows or len(rows) < 2:
        raise HTTPException(status_code=400, detail="Spreadsheet has no data rows. Please ensure the file has a header row and at least one data row.")

    # Normalize all rows to the same column count
    max_cols = max(len(r) for r in rows) if rows else 10

    def get_col_letter(index):
        temp = ""
        i = index
        while i >= 0:
            temp = chr((i % 26) + 65) + temp
            i = (i // 26) - 1
        return temp

    alphabet_headers = [get_col_letter(i) for i in range(max_cols)]

    normalized_rows = []
    for r in rows:
        row_vals = list(r)
        if len(row_vals) < max_cols:
            row_vals += [""] * (max_cols - len(row_vals))
        elif len(row_vals) > max_cols:
            row_vals = row_vals[:max_cols]
        normalized_rows.append(row_vals)

    # Build string grid for UI rendering (convert datetime → formatted string)
    grid_rows = []
    for r in normalized_rows:
        row_vals = []
        for x in r:
            if isinstance(x, (datetime, date)):
                row_vals.append(x.strftime('%d/%m/%Y'))
            else:
                row_vals.append(str(x))
        grid_rows.append(row_vals)

    excel_grid = [alphabet_headers] + grid_rows

    # Run SpreadsheetValidationEngine
    engine = SpreadsheetValidationEngine(db)
    result = await engine.validate(normalized_rows, filename)

    doc_type = result["doc_type"]
    column_mapping = result["column_mapping"]
    validation_results = result["validation_results"]
    summary = result["validation_summary"]

    confidence_score = min(98, 80 + int(summary["import_readiness_score"] * 0.18))

    return {
        "success": True,
        "excel_grid": excel_grid,
        "document_type": doc_type,
        "ai_reasoning": (
            f"Spreadsheet classified as {doc_type} with {len(column_mapping)} columns mapped. "
            f"Found {summary['error_count']} errors, {summary['warning_count']} warnings across "
            f"{summary['total_rows']} rows. Import readiness: {summary['import_readiness_score']}%."
        ),
        "column_mapping": column_mapping,
        "confidence_score": confidence_score,
        "import_readiness_score": summary["import_readiness_score"],
        "master_matching_results": {
            "party_status": "Perfect match" if not any(v["field"] == "Party Name" for v in validation_results if v["severity"] == "Error") else "Mismatch",
            "items_status": "Perfect match" if not any(v["field"] == "Item Name" for v in validation_results if v["severity"] == "Error") else "Mismatch"
        },
        "validation_results": validation_results,
        "validation_summary": summary,
    }
