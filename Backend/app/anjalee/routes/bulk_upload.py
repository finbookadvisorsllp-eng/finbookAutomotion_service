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
from typing import Optional, List, Dict, Any
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


def _run_ocr_background(file_path: str, file_type: str, upload_id: str, mongo_uri: str, db_name: str, company_id: str = None):
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
    from app.db import resolve_db_name
    try:
        client = pymongo.MongoClient(mongo_uri)
        target_db = resolve_db_name(company_id) if company_id else db_name
        db = client[target_db]

        # ── STAGE 2: Raw OCR ───────────────────────────────────────────────────
        logger.info(f"[BG] Stage 2 — OCR starting for upload_id={upload_id} in db={target_db}")
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

        if full_text.strip() or file_path:
            # ── STAGE 4: AI Agent & Bank Statement Auto-Classification ───────
            logger.info(f"[BG] Stage 4 — AI classification & extraction for upload_id={upload_id}")
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {"pipeline_stage": "ai_running", "pipeline_progress": 65}}
            )

            filename = (record or {}).get("filename", "") if record else ""
            source_type = (record or {}).get("source", "")

            # 1. Run AI Auto-Classification on document text
            sample_text = full_text[:4000] if full_text else filename
            ai_classification = llm_service.classify_bulk_upload_content(sample_text)

            is_bank_statement = (
                ai_classification.get("voucher_category") == "Bank Statement"
                or source_type == "Bank Statement Import"
                or any(k in filename.lower() for k in ["bank", "statement", "passbook", "optransactionhistory", "optransaction", "transaction", "history", "txn", "account_statement"])
                or any(k in full_text.lower()[:3000] for k in ["transactions list", "available balance", "statement of account", "bank statement", "withdrawal", "deposit", "cr/dr", "value date", "txn posted date"])
            )

            if is_bank_statement:
                logger.info(f"[BG] Document auto-classified as BANK STATEMENT for upload_id={upload_id}. Extracting row-wise vouchers...")
                from app.anjalee.services.bank_statement_ai_service import BankStatementAIService
                bank_service = BankStatementAIService(db)
                batch_res = bank_service.process_and_create_batch_draft(
                    file_path=file_path,
                    file_name=filename,
                    file_type=file_type,
                    bank_ledger="Bank Account",
                    company_id=company_id
                )
                
                ai_classification["voucher_category"] = "Bank Statement"

                items = batch_res.get("items", [])
                grid = [
                    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
                    ['Voucher Date', 'Voucher Type', 'Particulars / Narration', 'Reference No', 'Debit (Dr)', 'Credit (Cr)', 'Party / Counterpart Ledger', 'Amount', 'Status']
                ]
                for item in items:
                    tx_date = item.get("voucherDate", "")
                    v_type = item.get("voucherType", "Payment")
                    narration = item.get("narration", "")
                    ref_no = item.get("referenceNumber", "")
                    debit = f"{item.get('debit', 0.0):.2f}" if item.get('debit', 0.0) > 0 else ""
                    credit = f"{item.get('credit', 0.0):.2f}" if item.get('credit', 0.0) > 0 else ""
                    party_ledger = item.get("partyLedger") or item.get("againstLedger") or ""
                    amt = f"{item.get('amount', 0.0):.2f}"
                    status = "Valid" if item.get("status") in ["ready", "user_edited"] else "Review Required"
                    grid.append([tx_date, f"{v_type} Voucher", narration, ref_no, debit, credit, party_ledger, amt, status])

                col_mapping = [
                    {"original_name": "Voucher Date", "standard_erp_field": "Voucher Date", "col_idx": 0},
                    {"original_name": "Voucher Type", "standard_erp_field": "Voucher Type", "col_idx": 1},
                    {"original_name": "Particulars / Narration", "standard_erp_field": "Particulars", "col_idx": 2},
                    {"original_name": "Reference No", "standard_erp_field": "Reference No", "col_idx": 3},
                    {"original_name": "Debit (Dr)", "standard_erp_field": "Debit", "col_idx": 4},
                    {"original_name": "Credit (Cr)", "standard_erp_field": "Credit", "col_idx": 5},
                    {"original_name": "Party / Counterpart Ledger", "standard_erp_field": "Party Name", "col_idx": 6},
                    {"original_name": "Amount", "standard_erp_field": "Total Amount", "col_idx": 7},
                    {"original_name": "Status", "standard_erp_field": "Status", "col_idx": 8},
                ]

                grouped_vouchers = []
                for idx, item in enumerate(items):
                    v_type = item.get("voucherType", "Payment")
                    is_rec = v_type.lower() == "receipt" or float(item.get("credit", 0.0) or 0.0) > 0
                    grouped_vouchers.append({
                        "voucher_id": item.get("item_id") or f"VG-{str(idx+1).zfill(3)}",
                        "voucher_type": f"{v_type} Voucher",
                        "party_ledger": item.get("partyLedger") or item.get("againstLedger") or item.get("narration") or "Unspecified Party",
                        "invoice_date": item.get("voucherDate", ""),
                        "invoice_number": item.get("referenceNumber") or f"BS-{str(idx+1).zfill(4)}",
                        "ref_no": item.get("referenceNumber", ""),
                        "narration": item.get("narration", ""),
                        "debit": float(item.get("debit", 0.0) or 0.0),
                        "credit": float(item.get("credit", 0.0) or 0.0),
                        "amount": float(item.get("amount", 0.0) or 0.0),
                        "status": "Ready" if item.get("status") in ["ready", "user_edited"] else "Review Required",
                        "is_bank_statement": True,
                        "raw_type": "CR" if is_rec else "DR",
                        "confidence": item.get("confidence", 90),
                        "review_reason": item.get("review_reason", ""),
                        "user_reasoning": item.get("user_reasoning", "")
                    })

                db["bulk_uploads"].update_one(
                    {"_id": ObjectId(upload_id)},
                    {"$set": {
                        "document_type": "Bank Statement",
                        "type": "Bank Statement",
                        "category": "Financial",
                        "excel_grid": grid,
                        "excelData": grid,
                        "column_mapping": col_mapping,
                        "grouped_vouchers": grouped_vouchers,
                        "batch_id": batch_res.get("batch_id")
                    }}
                )

                schema = {
                    "document_type": "Bank Statement",
                    "overall_confidence": ai_classification.get("confidence", 98),
                    "sections": [
                        {
                            "id": "voucher_details",
                            "title": "Bank Statement Overview",
                            "order": 1,
                            "fields": [
                                {"id": "voucher_type", "label": "Voucher Category", "type": "text", "value": "Bank Statement", "editable": False},
                                {"id": "batch_id", "label": "Batch ID", "type": "text", "value": batch_res.get("batch_id"), "editable": False},
                                {"id": "total_transactions", "label": "Total Transactions Extracted", "type": "number", "value": len(items), "editable": False},
                                {"id": "narration", "label": "AI Reasoning", "type": "textarea", "value": ai_classification.get("reasoning", "Bank Statement with row-wise transactions extracted")}
                            ]
                        }
                    ],
                    "bank_statement_items": items,
                    "bank_statement_batch_id": batch_res.get("batch_id")
                }
            else:
                # Fetch base64 page image for Multimodal Vision AI (handwritten bills, photos, scans)
                vision_b64_url = None
                try:
                    b64_imgs = ocr_service.get_document_images_base64(file_path, file_type, max_pages=1)
                    if b64_imgs:
                        vision_b64_url = b64_imgs[0]
                        logger.info(f"[VISION AI OCR] Prepared Vision Image URL for upload_id={upload_id}")
                except Exception as b64_err:
                    logger.warning(f"[VISION AI OCR] Could not get base64 image: {b64_err}")

                schema = agent_orchestrator.extract(
                    full_text,
                    filename=filename,
                    our_company_name=company_name,
                    our_company_gstin=company_gstin,
                    layout_result=layout_result if 'layout_result' in locals() else None,
                    base64_image_url=vision_b64_url
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

            # Compute AI Auto-Classification across 6 accounting categories
            sample_text = full_text[:4000] if full_text else filename
            ai_classification = llm_service.classify_bulk_upload_content(sample_text)

            if is_bank_statement:
                doc_type_val = "Bank Statement"
                ai_classification["voucher_category"] = "Bank Statement"
                ai_classification["confidence"] = 98
                ai_classification["reasoning"] = "PDF Bank Statement Transaction History"
            else:
                doc_type_val = schema.get("document_type") or ai_classification.get("voucher_category") or "Unknown"

            cat_val = "Financial" if is_bank_statement or doc_type_val != "Unknown" else "Unknown"

            # Update bulk_uploads with final schema (keeps review UI working)
            final_status = "Ready For Review"
            db["bulk_uploads"].update_one(
                {"_id": ObjectId(upload_id)},
                {"$set": {
                    "status":            final_status,
                    "document_type":     doc_type_val,
                    "type":              doc_type_val,
                    "category":          cat_val,
                    "dynamic_schema":    schema,
                    "ai_classification": ai_classification,
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
                    DB_NAME,
                    existing.get("company_id")
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
        if not company_id:
            auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    from app.core.security import decode_token
                    token = auth_header.split(" ")[1]
                    claims = decode_token(token)
                    company_id = claims.get("orgId") or claims.get("companyId")
                except Exception:
                    pass

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
            DB_NAME,
            company_id
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
         "dynamic_schema": 1, "ocr_error": 1, "filename": 1, "ai_classification": 1}
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
        DB_NAME,
        record.get("company_id")
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
        p_led = cached_schema.get("partyLedger") or ""
        v_num = cached_schema.get("voucherNumber") or ""
        # Only return cached schema if partyLedger or voucherNumber is actually populated (not "Missing" or empty)
        if (p_led and p_led != "Missing") or (v_num and v_num != "Missing"):
            logger.info(f"ai_analyze: returning valid cached dynamic_schema for {upload_id}")
            return {
                "success": True,
                "upload_id": upload_id,
                "cached": True,
                "schema": record["dynamic_schema"]
            }
        else:
            logger.info(f"ai_analyze: cached schema has Missing fields. Forcing re-run for {upload_id}")

    # Ensure OCR is complete (or file exists for image vision analysis)
    ocr_data = record.get("ocr_data") or {}
    file_path = record.get("file_path") or ""
    file_type = record.get("file_type") or "pdf"

    # Build full text from all OCR pages
    pages = ocr_data.get("pages", [])
    full_text = "\n\n".join(
        f"[Page {p.get('page_number', i + 1)}]\n{p.get('text', '')}"
        for i, p in enumerate(pages)
        if p.get("text", "").strip()
    )

    if not full_text.strip() and not file_path:
        raise HTTPException(status_code=400, detail="OCR text and file path are both empty. Cannot analyze document.")

    # Fetch base64 page image for Multimodal Vision AI (handwritten bills, photos, scans)
    vision_b64_url = None
    if file_path:
        try:
            b64_imgs = ocr_service.get_document_images_base64(file_path, file_type, max_pages=1)
            if b64_imgs:
                vision_b64_url = b64_imgs[0]
                logger.info(f"[VISION AI OCR] Prepared Vision Image URL for upload_id={upload_id} in ai_analyze")
        except Exception as b64_err:
            logger.warning(f"[VISION AI OCR] Could not get base64 image in ai_analyze: {b64_err}")

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
        record.get("filename", ""),
        vision_b64_url
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


def build_synthesized_grid_and_vouchers(r: dict) -> tuple[list, list]:
    """
    Ensures excel_grid and grouped_vouchers are non-empty for documents that
    have extracted data in bank_statement_items, dynamic_schema, or ocr_data.
    """
    existing_grid = r.get("excel_grid") or r.get("excelData")
    existing_vouchers = r.get("grouped_vouchers") or r.get("groupedVouchers")

    if existing_grid and isinstance(existing_grid, list) and len(existing_grid) >= 3 and existing_vouchers and isinstance(existing_vouchers, list) and len(existing_vouchers) > 0:
        return existing_grid, existing_vouchers

    grid = [
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
        ['Voucher Date', 'Voucher Type', 'Particulars / Narration', 'Reference No', 'Debit (Dr)', 'Credit (Cr)', 'Party / Counterpart Ledger', 'Amount', 'Status']
    ]
    grouped_vouchers = list(existing_vouchers) if (existing_vouchers and isinstance(existing_vouchers, list)) else []

    dyn_schema = r.get("dynamic_schema") or {}
    items = dyn_schema.get("bank_statement_items") or r.get("bank_statement_items") or []

    if not items and isinstance(dyn_schema.get("sections"), list):
        for sec in dyn_schema.get("sections", []):
            if isinstance(sec, dict) and "fields" in sec:
                for field in sec.get("fields", []):
                    if isinstance(field, dict) and field.get("type") == "table" and "rows" in field:
                        items = field.get("rows", [])
                        break

    if items and len(grouped_vouchers) == 0:
        for idx, item in enumerate(items):
            if isinstance(item, dict):
                tx_date = item.get("voucherDate") or item.get("invoiceDate") or item.get("date") or ""
                v_type = item.get("voucherType") or item.get("type") or "Payment"
                narration = item.get("narration") or item.get("particulars") or item.get("description") or ""
                ref_no = item.get("referenceNumber") or item.get("refNo") or item.get("invoiceNumber") or f"BS-{str(idx+1).zfill(4)}"
                debit_val = float(item.get("debit", 0.0) or item.get("debitAmount", 0.0) or 0.0)
                credit_val = float(item.get("credit", 0.0) or item.get("creditAmount", 0.0) or 0.0)
                party_ledger = item.get("partyLedger") or item.get("partyName") or item.get("againstLedger") or narration or "Unspecified Party"
                total_amt = float(item.get("amount", 0.0) or item.get("totalAmount", 0.0) or (debit_val if debit_val > 0 else credit_val))
                is_rec = credit_val > 0 or "receipt" in str(v_type).lower()

                v_type_str = f"{v_type if 'Voucher' in str(v_type) else str(v_type) + ' Voucher'}"
                grouped_vouchers.append({
                    "voucher_id": item.get("item_id") or f"VG-{str(idx+1).zfill(3)}",
                    "voucher_type": v_type_str,
                    "party_ledger": party_ledger,
                    "invoice_date": tx_date,
                    "invoice_number": ref_no,
                    "ref_no": ref_no,
                    "narration": narration,
                    "debit": debit_val,
                    "credit": credit_val,
                    "amount": total_amt,
                    "status": "Ready",
                    "is_bank_statement": True,
                    "raw_type": "CR" if is_rec else "DR",
                    "confidence": item.get("confidence", 95),
                    "review_reason": item.get("review_reason", "Extracted transaction"),
                    "user_reasoning": item.get("user_reasoning", "Extracted transaction")
                })

    if grouped_vouchers and len(grid) == 2:
        for v in grouped_vouchers:
            tx_date = v.get("invoice_date", "")
            v_type = v.get("voucher_type", "Payment Voucher")
            narr = v.get("narration", "")
            ref_no = v.get("ref_no") or v.get("invoice_number", "")
            debit_str = f"{v.get('debit', 0.0):.2f}" if v.get('debit', 0.0) > 0 else ""
            credit_str = f"{v.get('credit', 0.0):.2f}" if v.get('credit', 0.0) > 0 else ""
            party = v.get("party_ledger", "")
            amt_str = f"{v.get('amount', 0.0):.2f}"
            st = v.get("status", "Ready")
            grid.append([tx_date, v_type, narr, ref_no, debit_str, credit_str, party, amt_str, st])

    final_grid = existing_grid if (existing_grid and isinstance(existing_grid, list) and len(existing_grid) >= 3) else grid
    final_vouchers = grouped_vouchers if (grouped_vouchers and isinstance(grouped_vouchers, list) and len(grouped_vouchers) > 0) else (existing_vouchers or [])
    return final_grid, final_vouchers


@router.get("", response_model=dict)
async def list_uploads(
    company_id: Optional[str] = None,
    db = Depends(get_async_db)
):
    """
    Lists all bulk uploads from database.
    Checks primary tenant DB and fallback DB so uploaded records are never missing.
    """
    try:
        cursor = db["bulk_uploads"].find().sort("upload_date", -1)
        if hasattr(cursor, "to_list"):
            res = cursor.to_list(length=100)
            records = await res if (asyncio.iscoroutine(res) or hasattr(res, "__await__")) else res
        else:
            records = list(cursor[:100])

        if not records:
            from app.db import client
            fallback_db = client["finbook_23aafff9731l1z7"]
            fb_cursor = fallback_db["bulk_uploads"].find().sort("upload_date", -1)
            records = list(fb_cursor[:100])

        uploads = []
        for r in records:
            file_path = r.get("file_path")
            file_url = f"/bulk-upload/file/{str(r['_id'])}"

            # Handle size conversion safely
            file_size = r.get("file_size", "2.4 MB")
            if file_path and os.path.exists(file_path):
                sz = os.path.getsize(file_path)
                if sz > 1024 * 1024:
                    file_size = f"{sz / (1024 * 1024):.1f} MB"
                else:
                    file_size = f"{sz / 1024:.0f} KB"

            syn_grid, syn_vouchers = build_synthesized_grid_and_vouchers(r)

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
                "confidence": r.get("confidence_score") or r.get("confidence") or r.get("dynamic_schema", {}).get("confidence") or 98,
                "confidence_score": r.get("confidence_score") or r.get("import_readiness_score") or 98,
                "fileUrl": file_url,
                "dynamic_schema": r.get("dynamic_schema"),
                "excel_grid": syn_grid,
                "excelData": syn_grid,
                "column_mapping": r.get("column_mapping", []),
                "columnMapping": r.get("column_mapping", []),
                "validation_results": r.get("validation_results", []),
                "validationResults": r.get("validation_results", []),
                "validation_summary": r.get("validation_summary", {}),
                "validationSummary": r.get("validation_summary", {}),
                "grouped_vouchers": syn_vouchers,
                "groupedVouchers": syn_vouchers,
                "ai_reasoning": r.get("ai_reasoning", ""),
                "aiReasoning": r.get("ai_reasoning", "")
            })
        return {"success": True, "documents": uploads}
    except Exception as e:
        logger.error(f"Failed to list uploads: {e}")
        return {"success": False, "error": str(e)}


@router.get("/templates/download/{template_name}")
async def download_excel_template(template_name: str):
    """
    Serves downloadable standard Excel templates for Sales & Purchase vouchers (With & Without Item).
    """
    from fastapi.responses import FileResponse
    t_clean = template_name.lower().replace("%20", "-").replace(" ", "-").replace("_", "-")
    if "sales" in t_clean and "without" in t_clean:
        filename = "Sales_Voucher_Template_Without_Item.xlsx"
    elif "sales" in t_clean:
        filename = "Sales_Voucher_Template_With_Item.xlsx"
    elif "purchase" in t_clean and "without" in t_clean:
        filename = "Purchase_Voucher_Template_Without_Item.xlsx"
    elif "purchase" in t_clean:
        filename = "Purchase_Voucher_Template_With_Item.xlsx"
    else:
        filename = valid_templates.get(t_clean, "Sales_Voucher_Template_With_Item.xlsx")
    candidate_paths = [
        os.path.join("uploads", "templates", filename),
        os.path.join("Backend", "uploads", "templates", filename),
        os.path.join("Backend", "Backend", "uploads", "templates", filename),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "templates", filename))
    ]
    file_path = next((p for p in candidate_paths if os.path.exists(p)), None)
    if not file_path:
        raise HTTPException(status_code=404, detail=f"Template file '{filename}' missing on server.")
        
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )


@router.get("/saved-vouchers", response_model=dict)
async def get_saved_bulk_vouchers(
    company_id: Optional[str] = None,
    db = Depends(get_async_db)
):
    """
    Fetches all individual vouchers saved from Bulk Upload across sales_vouchers, purchase_vouchers, and vouchers collections.
    """
    query = {
        "$or": [
            {"source": "Bulk Upload"},
            {"isBulkUpload": True}
        ]
    }

    vouchers_map = {}

    for coll_name in ["sales_vouchers", "purchase_vouchers", "vouchers"]:
        cursor = db[coll_name].find(query).sort("created_at", -1)
        if hasattr(cursor, "to_list"):
            res = cursor.to_list(length=1000)
            docs = await res if (asyncio.iscoroutine(res) or hasattr(res, "__await__")) else res
        else:
            docs = list(cursor[:1000])

        for doc in docs:
            v_no = doc.get("voucherNumber") or doc.get("invoiceNumber") or str(doc["_id"])
            if v_no not in vouchers_map:
                doc["_id"] = str(doc["_id"])
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                vouchers_map[v_no] = doc

    deduplicated = list(vouchers_map.values())
    return {
        "success": True,
        "count": len(deduplicated),
        "vouchers": deduplicated
    }


@router.delete("/saved-vouchers/{voucher_identifier}", response_model=dict)
async def delete_saved_bulk_voucher(
    voucher_identifier: str,
    company_id: Optional[str] = None,
    db = Depends(get_async_db)
):
    """
    Deletes a saved voucher from MongoDB across sales_vouchers, purchase_vouchers, and vouchers collections.
    Accepts voucherNumber or MongoDB ObjectId string.
    """
    query_conditions = [
        {"voucherNumber": voucher_identifier},
        {"invoiceNumber": voucher_identifier},
        {"vchNo": voucher_identifier}
    ]

    if ObjectId.is_valid(voucher_identifier):
        query_conditions.append({"_id": ObjectId(voucher_identifier)})

    query = {"$or": query_conditions}

    deleted_count = 0
    for coll_name in ["sales_vouchers", "purchase_vouchers", "vouchers", "fund_flow_transactions"]:
        res = await db[coll_name].delete_many(query)
        deleted_count += res.deleted_count

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted voucher '{voucher_identifier}' from MongoDB!"
    }


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

    syn_grid, syn_vouchers = build_synthesized_grid_and_vouchers(record)

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
        "confidence": record.get("confidence_score") or record.get("confidence") or (dynamic_schema or {}).get("confidence") or 98,
        "confidence_score": record.get("confidence_score") or record.get("import_readiness_score") or 98,
        "fileUrl": record.get("file_url") or f"/bulk-upload/file/{str(record['_id'])}",
        "dynamic_schema": dynamic_schema,
        "excel_grid": syn_grid,
        "excelData": syn_grid,
        "column_mapping": record.get("column_mapping", []),
        "validation_results": record.get("validation_results", []),
        "validation_summary": record.get("validation_summary", {}),
        "grouped_vouchers": syn_vouchers,
        "groupedVouchers": syn_vouchers,
        "ai_reasoning": record.get("ai_reasoning", "")
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


@router.post("/analyze-spreadsheet", response_model=dict)
async def analyze_spreadsheet(
    file: UploadFile = File(...),
    db = Depends(get_async_db)
):
    """
    Full accounting-grade AI validation engine for bulk Excel/CSV uploads.
    """
    import hashlib
    from app.anjalee.services.spreadsheet_validator import SpreadsheetValidationEngine
    from app.anjalee.services.voucher_grouping_engine import VoucherGroupingEngine
    from app.anjalee.services.master_mapping_engine import MasterMappingEngine

    filename = file.filename or "spreadsheet.xlsx"
    contents = await file.read()
    ext = filename.rsplit('.', 1)[-1].lower()

    # Generate SHA-256 fingerprint of normalized file content
    file_hash = hashlib.sha256(contents).hexdigest()

    # Check for exact duplicate file in MongoDB
    existing_file = await db["bulk_uploads"].find_one({"file_hash": file_hash})
    is_duplicate_file = existing_file is not None

    # Save physical file persistently to local uploads directory on disk
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(saved_file_path, "wb") as f:
        f.write(contents)

    file_size_formatted = f"{len(contents) / (1024 * 1024):.1f} MB" if len(contents) > 1024 * 1024 else f"{len(contents) / 1024:.0f} KB"

    # Insert persistent record into bulk_uploads MongoDB collection
    upload_doc = {
        "filename": filename,
        "file_hash": file_hash,
        "file_path": saved_file_path,
        "file_url": f"/uploads/bulk-upload/{unique_filename}",
        "file_size": file_size_formatted,
        "upload_date": datetime.utcnow(),
        "uploaded_by": "Anjal Singh (You)",
        "status": "DUPLICATE_FILE" if is_duplicate_file else "Analyzed",
        "source": "Bulk Upload Engine",
        "category": "Accounting Spreadsheet",
    }
    insert_res = await db["bulk_uploads"].insert_one(upload_doc)
    persistent_upload_id = str(insert_res.inserted_id)

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

    # Compute AI Auto-Classification across 6 accounting categories
    grid_sample_text = "\n".join([", ".join([str(c) for c in r[:10]]) for r in grid_rows[:15]])
    ai_classification = llm_service.classify_bulk_upload_content(grid_sample_text)

    # Run SpreadsheetValidationEngine
    engine = SpreadsheetValidationEngine(db)
    result = await engine.validate(normalized_rows, filename)

    excel_grid = result.get("excel_grid", excel_grid)
    doc_type = result["doc_type"]
    column_mapping = result["column_mapping"]
    col_idx = result["col_idx"]
    validation_results = result["validation_results"]
    summary = result["validation_summary"]

    # Group item-wise rows into unified accounting vouchers
    grouped_vouchers = VoucherGroupingEngine.group_rows(excel_grid, col_idx, doc_type)

    confidence_score = min(98, 80 + int(summary["import_readiness_score"] * 0.18))
    ai_reasoning_text = (
        f"Spreadsheet classified as {doc_type} with {len(column_mapping)} columns mapped. "
        f"Grouped into {len(grouped_vouchers)} vouchers across {summary['total_rows']} rows. "
        f"Found {summary['error_count']} errors, {summary['warning_count']} warnings. Import readiness: {summary['import_readiness_score']}%."
    )

    # Persist the full extracted Excel grid, grouped vouchers, column mapping and AI validation results in MongoDB
    await db["bulk_uploads"].update_one(
        {"_id": insert_res.inserted_id},
        {"$set": {
            "excel_grid": excel_grid,
            "document_type": doc_type,
            "column_mapping": column_mapping,
            "grouped_vouchers": grouped_vouchers,
            "validation_results": validation_results,
            "validation_summary": summary,
            "confidence_score": confidence_score,
            "import_readiness_score": summary["import_readiness_score"],
            "ai_reasoning": ai_reasoning_text,
            "ai_classification": ai_classification,
            "status": "DUPLICATE_FILE" if is_duplicate_file else "Ready For Review"
        }}
    )

    return {
        "success": True,
        "upload_id": persistent_upload_id,
        "is_duplicate_file": is_duplicate_file,
        "previous_upload": {
            "filename": existing_file.get("filename"),
            "uploaded_on": existing_file.get("upload_date").strftime("%d-%m-%Y, %I:%M %p") if existing_file.get("upload_date") else "",
            "status": existing_file.get("status")
        } if is_duplicate_file else None,
        "file_url": f"/uploads/bulk-upload/{unique_filename}",
        "excel_grid": excel_grid,
        "document_type": doc_type,
        "grouped_vouchers": grouped_vouchers,
        "ai_reasoning": ai_reasoning_text,
        "column_mapping": column_mapping,
        "confidence_score": confidence_score,
        "import_readiness_score": summary["import_readiness_score"],
        "master_matching_results": {
            "party_status": "Perfect match" if not any(v["field"] == "Party Name" for v in validation_results if v["severity"] == "Error") else "Mismatch",
            "items_status": "Perfect match" if not any(v["field"] == "Item Name" for v in validation_results if v["severity"] == "Error") else "Mismatch"
        },
        "validation_results": validation_results,
        "validation_summary": summary
    }


@router.post("/master-mappings/approve", response_model=dict)
async def approve_master_mapping(
    payload: dict,
    request: Request,
    db = Depends(get_async_db)
):
    """
    Saves a user-approved master mapping into company_aliases collection
    and updates matching rows in the uploaded document.
    """
    from app.anjalee.services.master_mapping_engine import MasterMappingEngine
    
    upload_id = payload.get("upload_id")
    uploaded_value = payload.get("uploaded_value")
    approved_master_name = payload.get("approved_master_name")
    category = payload.get("category", "party")
    company_id = payload.get("company_id") if (payload.get("company_id") and str(payload.get("company_id")).lower() not in ("default", "undefined", "null")) else extract_company_ref_from_request(request)

    if not uploaded_value or not approved_master_name:
        raise HTTPException(status_code=400, detail="uploaded_value and approved_master_name are required.")

    mapping_engine = MasterMappingEngine(db, company_id=company_id)
    await mapping_engine.save_alias(uploaded_value, approved_master_name, category)

    return {
        "success": True,
        "message": f"Saved alias mapping: '{uploaded_value}' -> '{approved_master_name}'",
        "approved_master_name": approved_master_name
    }


class SaveBulkVouchersRequest(BaseModel):
    upload_id: Optional[str] = "bulk_upload"
    company_id: Optional[str] = "default"
    status: Optional[str] = "draft"
    vouchers: list = []

@router.post("/save-vouchers", response_model=dict)
async def save_bulk_vouchers(
    payload: SaveBulkVouchersRequest,
    request: Request,
    db = Depends(get_async_db)
):
    """
    Saves bulk upload vouchers into MongoDB collections ('sales_vouchers', 'purchase_vouchers', 'vouchers')
    per voucher number, making them accessible across the entire system and matching manual voucher entry.
    """
    upload_id = payload.upload_id or "bulk_upload"
    comp_header = request.headers.get("x-company-id") or request.headers.get("x-company") or request.headers.get("x-org-id")
    company_id = payload.company_id if (payload.company_id and payload.company_id != "default") else (comp_header or "default")
    save_status = payload.status or "draft"
    vouchers = payload.vouchers or []

    if not vouchers:
        return {"success": True, "saved_count": 0, "message": "No vouchers provided"}

    saved_count = 0
    saved_vouchers_list = []

    from app.anjalee.services.voucher_number_service import VoucherNumberService

    for vch in vouchers:
        ext_invoice_no = vch.get("invoiceNumber") or vch.get("vchNo") or vch.get("voucherNo") or ""
        vch_type_raw = str(vch.get("docType") or vch.get("voucherType") or "Sales Voucher").strip()
        vch_type_lower = vch_type_raw.lower()
        
        is_sales = "sales" in vch_type_lower
        is_purchase = "purchase" in vch_type_lower
        is_payment = "payment" in vch_type_lower
        is_receipt = "receipt" in vch_type_lower

        if is_purchase:
            voucher_type = "purchase_invoice"
            coll_target = "purchase_vouchers"
        elif is_sales:
            voucher_type = "sales_invoice"
            coll_target = "sales_vouchers"
        else:
            voucher_type = vch_type_raw
            coll_target = "vouchers"

        # Check if this voucher has ALREADY been saved in the database under company_id
        vch_id = vch.get("id") or vch.get("_id")
        assigned_vch_no = None

        if vch_id and not str(vch_id).startswith("draft_") and not str(vch_id).startswith("vch_"):
            try:
                existing_doc = await db[coll_target].find_one({"_id": ObjectId(vch_id)}) if ObjectId.is_valid(vch_id) else None
                if existing_doc:
                    assigned_vch_no = existing_doc.get("voucherNumber")
            except Exception:
                pass

        if not assigned_vch_no:
            assigned_vch_no = await VoucherNumberService.get_next_voucher_number(
                db=db,
                company_id=company_id,
                voucher_type=voucher_type,
                series_id="MAIN"
            )

        vch_no = assigned_vch_no
        vch_date = vch.get("dateVal") or vch.get("voucherDate") or vch.get("invoiceDate") or vch.get("date") or datetime.now().strftime("%Y-%m-%d")
        party_name = vch.get("party") or vch.get("partyName") or vch.get("partyLedgerName") or "Unspecified Party"
        party_gstin = vch.get("partyGstin") or vch.get("partyGSTIN") or vch.get("gstin") or ""
        
        # Calculate item lines
        raw_items = vch.get("items") or vch.get("productLines") or vch.get("inventoryEntries") or []
        formatted_items = []
        
        total_base = 0.0
        total_cgst = 0.0
        total_sgst = 0.0
        total_igst = 0.0
        
        for idx, item in enumerate(raw_items):
            stock_item = item.get("stockItem") or item.get("itemName") or item.get("name") or "Stock Item"
            hsn = item.get("hsnSacCode") or item.get("hsnSac") or item.get("hsnCode") or item.get("hsn") or ""
            qty = float(item.get("billQuantity") or item.get("quantity") or item.get("qty") or 0.0)
            rate = float(item.get("billRate") or item.get("rate") or 0.0)
            amt = float(item.get("amount") or (qty * rate) or 0.0)
            taxable = float(item.get("taxableAmount") or item.get("taxable") or amt)
            gst_rate = float(item.get("gstRate") or item.get("gst_percent") or 0.0)
            
            cgst = float(item.get("cgst") or 0.0)
            sgst = float(item.get("sgst") or 0.0)
            igst = float(item.get("igst") or 0.0)
            
            if gst_rate > 0 and (cgst == 0 and sgst == 0 and igst == 0):
                if party_gstin and len(party_gstin) >= 2 and not party_gstin.startswith("23"):
                    igst = round(taxable * (gst_rate / 100.0), 2)
                else:
                    half_tax = round(taxable * (gst_rate / 200.0), 2)
                    cgst = half_tax
                    sgst = half_tax

            total_tax = cgst + sgst + igst
            
            total_base += taxable
            total_cgst += cgst
            total_sgst += sgst
            total_igst += igst
            
            formatted_items.append({
                "srNo": idx + 1,
                "stockItemId": str(ObjectId()),
                "stockItem": stock_item,
                "description": item.get("description") or item.get("remarks") or "",
                "hsnSacCode": hsn,
                "billQuantity": qty,
                "billRate": rate,
                "discountPercent": float(item.get("discountPercent") or 0.0),
                "amount": amt if amt > 0 else taxable,
                "taxableAmount": taxable,
                "gstRate": gst_rate,
                "cgst": cgst,
                "sgst": sgst,
                "igst": igst,
                "totalTax": total_tax
            })
            
        calc_total = total_base + total_cgst + total_sgst + total_igst
        grand_total = float(vch.get("totalAmount") or vch.get("grandTotal") or vch.get("amount") or (calc_total if calc_total > 0 else 0.0))
        
        is_intra = (total_igst == 0)
        company_id_val = ObjectId(company_id) if (company_id and ObjectId.is_valid(company_id)) else company_id

        # EXACT KEY-VALUE PAIRS MATCHING MANUAL VOUCHER ENTRY (sales_service.py)
        doc = {
            "companyId": company_id_val,
            "company_id": company_id_val,
            "orgId": company_id_val,
            "voucherNumber": vch_no,
            "invoiceNumber": ext_invoice_no or vch_no,
            "voucherDate": vch_date,
            "voucherType": voucher_type,
            "voucherSeries": "Default",
            "referenceNumber": vch.get("referenceNumber"),
            "creditNoteDate": vch.get("creditNoteDate"),
            "docType": vch_type_raw,
            "salesLedger": vch.get("salesLedger") or vch.get("ledger") or ("Sales" if is_sales else "Purchase"),
            "consigneeLedger": vch.get("consigneeLedger"),
            "consigneeGstin": vch.get("consigneeGstin") or "",
            "partyLedgerId": None,
            "partyLedgerName": party_name,
            "partyName": party_name,
            "partyLedger": party_name,
            "party": party_name,
            "partyGSTIN": party_gstin,
            "gstRegistrationType": "Regular" if party_gstin else "Consumer",
            "partyState": vch.get("partyState") or vch.get("state") or "Madhya Pradesh",
            "companyState": "Madhya Pradesh",
            "isIntraState": is_intra,
            "taxType": "CGST_SGST" if is_intra else "IGST",
            "baseAmount": total_base,
            "cgstAmount": total_cgst,
            "sgstAmount": total_sgst,
            "igstAmount": total_igst,
            "cessAmount": 0.0,
            "tcsAmount": 0.0,
            "roundOffAmount": round(grand_total - (total_base + total_cgst + total_sgst + total_igst), 2),
            "grandTotal": grand_total,
            "totalAmount": grand_total,
            "amount": grand_total,
            "entryTab": "with_item" if formatted_items else "without_item",
            "gstRegistration": party_name,
            "entryMode": "bulk_upload",
            "ocrMetadata": vch.get("ocrMetadata"),
            "bulkMetadata": vch.get("bulkMetadata"),
            "salesEntries": [],
            "inventoryEntries": formatted_items,
            "productLines": formatted_items,
            "items": formatted_items,
            "additionalCharges": [],
            "tcsDetails": [],
            "tdsDetails": [],
            "gstSummary": {
                "taxableValue": total_base,
                "cgst": total_cgst,
                "sgst": total_sgst,
                "igst": total_igst
            },
            "narration": vch.get("narration") or f"Bulk Uploaded Voucher {vch_no}",
            "status": "APPROVED" if save_status == "approved" else "DRAFT",
            "isBulkUpload": True,
            "source": "Bulk Upload",
            "bulkUploadId": upload_id,
            "isDeleted": False,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        query = {
            "companyId": company_id,
            "$or": [
                {"voucherNumber": vch_no},
                {"invoiceNumber": vch_no}
            ]
        }

        # 1. General vouchers collection
        await db["vouchers"].update_one(query, {"$set": doc}, upsert=True)

        # 2. Type-specific collections (matching manual voucher entry)
        if is_sales:
            await db["sales_vouchers"].update_one(query, {"$set": doc}, upsert=True)
        elif is_purchase:
            await db["purchase_vouchers"].update_one(query, {"$set": doc}, upsert=True)
        else:
            await db["fund_flow_transactions"].update_one(query, {"$set": doc}, upsert=True)

        saved_vouchers_list.append({
            "id": str(doc.get("_id") or vch_no),
            "voucherNumber": vch_no,
            "voucherNo": vch_no,
            "vchNo": vch_no,
            "invoiceNumber": ext_invoice_no or vch_no,
            "partyName": party_name,
            "voucherDate": vch_date,
            "voucherType": voucher_type,
            "grandTotal": grand_total,
            "amount": grand_total,
            "status": new_doc_status
        })

        saved_count += 1

    if upload_id and ObjectId.is_valid(upload_id):
        await db["bulk_uploads"].update_one(
            {"_id": ObjectId(upload_id)},
            {"$set": {"status": new_doc_status, "updated_at": datetime.utcnow()}}
        )

    return {
        "success": True,
        "saved_count": saved_count,
        "vouchers": saved_vouchers_list,
        "message": f"Successfully saved {saved_count} vouchers into MongoDB!"
    }



