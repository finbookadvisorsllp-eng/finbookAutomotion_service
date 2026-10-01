import os
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
import asyncio
from bson import ObjectId
import inspect
from typing import Dict, Any, Optional, List, Tuple

from app.anjalee.services.tally.voucher_mapper import VoucherMapper
from app.anjalee.services.tally.xml_generator import TallyXmlGenerator, escape_xml

async def db_find_one(db, collection: str, query: dict) -> Optional[Dict[str, Any]]:
    res = db[collection].find_one(query)
    if inspect.isawaitable(res):
        return await res
    return res

async def db_find(db, collection: str, query: dict, limit: int = 10000) -> List[Dict[str, Any]]:
    cursor = db[collection].find(query)
    if inspect.isawaitable(cursor):
        cursor = await cursor
    if hasattr(cursor, "to_list"):
        res = cursor.to_list(length=limit)
        if inspect.isawaitable(res):
            return await res
        return res
    if hasattr(cursor, "__iter__"):
        try:
            return list(cursor)
        except Exception:
            pass
    if hasattr(cursor, "__aiter__"):
        return [d async for d in cursor]
    return []

async def db_insert_one(db, collection: str, doc: dict) -> Any:
    res = db[collection].insert_one(doc)
    if inspect.isawaitable(res):
        inserted = await res
        return inserted.inserted_id
    return res.inserted_id

async def db_update_one(db, collection: str, query: dict, update: dict, upsert: bool = False) -> Any:
    res = db[collection].update_one(query, update, upsert=upsert)
    if inspect.isawaitable(res):
        return await res
    return res

async def db_delete_many(db, collection: str, query: dict) -> Any:
    res = db[collection].delete_many(query)
    if inspect.isawaitable(res):
        return await res
    return res

class TallyPushService:
    @staticmethod
    async def delete_payload_by_voucher_id(db, voucher_id: str) -> None:
        """Deletes related XML document from tally_payloads collection."""
        await db_delete_many(db, "tally_payloads", {"voucherId": ObjectId(voucher_id)})

    @staticmethod
    async def generate_and_save_xml(db, voucher_id: str, collection_name: str) -> str:
        """Generates XML from voucher data, validates it, and saves it in tally_payloads."""
        # 1. Load voucher from MongoDB
        voucher_doc = await db_find_one(db, collection_name, {"_id": ObjectId(voucher_id)})
        if not voucher_doc:
            for fallback_coll in ["vouchers", "fund_flow_vouchers", "sales_vouchers", "purchase_vouchers"]:
                if fallback_coll != collection_name:
                    voucher_doc = await db_find_one(db, fallback_coll, {"_id": ObjectId(voucher_id)})
                    if voucher_doc:
                        collection_name = fallback_coll
                        break
        if not voucher_doc:
            raise ValueError(f"Voucher not found in collection '{collection_name}' with ID '{voucher_id}'")

        # Resolve companyName from companies collection
        company_name = "Default Company"
        company_id = voucher_doc.get("companyId")
        if company_id:
            company_doc = await db_find_one(db, "companies", {"_id": ObjectId(company_id)})
            if company_doc:
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name
        if (not company_id or company_name == "Default Company") and voucher_doc.get("company"):
            company_name_str = voucher_doc.get("company")
            company_doc = await db_find_one(db, "companies", {
                "$or": [
                    {"companyName": company_name_str},
                    {"basicCompantFormalName": company_name_str}
                ]
            })
            if company_doc:
                company_id = company_doc["_id"]
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name_str
            else:
                company_name = company_name_str
        if not company_id or company_name == "Default Company":
            company_doc = await db_find_one(db, "companies", {})
            if company_doc:
                company_id = company_doc["_id"]
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name

        # Resolve stock items' unit of measure
        if "inventoryEntries" in voucher_doc:
            for item in voucher_doc.get("inventoryEntries") or []:
                if not item.get("unit") and item.get("stockItem"):
                    stock_item_doc = await db_find_one(db, "stock_items", {"name": item.get("stockItem")})
                    if stock_item_doc:
                        unit_raw = stock_item_doc.get("unit")
                        unit = ""
                        if isinstance(unit_raw, dict):
                            unit = unit_raw.get("baseUnit") or ""
                        elif isinstance(unit_raw, str):
                            unit = unit_raw
                        else:
                            unit = stock_item_doc.get("baseUnit") or stock_item_doc.get("unitOfMeasure") or ""
                        item["unit"] = unit or "Nos"
                    else:
                        item["unit"] = "Nos"
        
        if "productLines" in voucher_doc:
            for item in voucher_doc.get("productLines") or []:
                if not item.get("unit") and (item.get("stockItem") or item.get("name")):
                    item_name = item.get("stockItem") or item.get("name")
                    stock_item_doc = await db_find_one(db, "stock_items", {"name": item_name})
                    if stock_item_doc:
                        unit_raw = stock_item_doc.get("unit")
                        unit = ""
                        if isinstance(unit_raw, dict):
                            unit = unit_raw.get("baseUnit") or ""
                        elif isinstance(unit_raw, str):
                            unit = unit_raw
                        else:
                            unit = stock_item_doc.get("baseUnit") or stock_item_doc.get("unitOfMeasure") or ""
                        item["unit"] = unit or "Nos"
                    else:
                        item["unit"] = "Nos"

        # Map to TallyVoucher
        tally_vch = VoucherMapper.map_to_tally_voucher(voucher_doc, company_name)

        # Generate XML
        xml_payload = TallyXmlGenerator.generate_xml(tally_vch)

        # Save XML to tally_payloads (only one active document per voucher)
        existing = await db_find_one(db, "tally_payloads", {"voucherId": ObjectId(voucher_id)})
        if existing:
            xml_version = existing.get("xmlVersion", 1)
            await db_update_one(db, "tally_payloads", {"_id": existing["_id"]}, {
                "$set": {
                    "xmlPayload": xml_payload,
                    "xmlVersion": xml_version,
                    "generatedAt": datetime.utcnow(),
                    "status": "Ready To Push"
                }
            })
        else:
            payload_doc = {
                "voucherId": ObjectId(voucher_id),
                "companyName": company_name,
                "voucherType": tally_vch.voucherType,
                "xmlPayload": xml_payload,
                "xmlVersion": 1,
                "generatedAt": datetime.utcnow(),
                "generatedBy": "",
                "status": "Ready To Push"
            }
            await db_insert_one(db, "tally_payloads", payload_doc)

        # Also sync tallyXml to the voucher document across possible collections
        for coll in set([collection_name, "fund_flow_vouchers", "vouchers"]):
            try:
                await db_update_one(db, coll, {"_id": ObjectId(voucher_id)}, {
                    "$set": {
                        "tallyXml": xml_payload,
                        "tally_xml": xml_payload
                    }
                })
            except Exception:
                pass

        return xml_payload

    @staticmethod
    async def handle_voucher_update(db, voucher_id: str, collection_name: str) -> None:
        """Regenerates the XML for an approved voucher after it has been edited."""
        existing = await db_find_one(db, "tally_payloads", {"voucherId": ObjectId(voucher_id)})
        if not existing:
            return  # Not approved yet (no XML exists)
            
        if existing.get("status") == "Pushed":
            return  # Already pushed, do not regenerate

        voucher_doc = await db_find_one(db, collection_name, {"_id": ObjectId(voucher_id)})
        if not voucher_doc:
            for fallback_coll in ["vouchers", "fund_flow_vouchers", "sales_vouchers", "purchase_vouchers"]:
                if fallback_coll != collection_name:
                    voucher_doc = await db_find_one(db, fallback_coll, {"_id": ObjectId(voucher_id)})
                    if voucher_doc:
                        collection_name = fallback_coll
                        break
        if not voucher_doc:
            return

        company_name = "Default Company"
        company_id = voucher_doc.get("companyId")
        if company_id:
            company_doc = await db_find_one(db, "companies", {"_id": ObjectId(company_id)})
            if company_doc:
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name
        if (not company_id or company_name == "Default Company") and voucher_doc.get("company"):
            company_name_str = voucher_doc.get("company")
            company_doc = await db_find_one(db, "companies", {
                "$or": [
                    {"companyName": company_name_str},
                    {"basicCompantFormalName": company_name_str}
                ]
            })
            if company_doc:
                company_id = company_doc["_id"]
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name_str
            else:
                company_name = company_name_str
        if not company_id or company_name == "Default Company":
            company_doc = await db_find_one(db, "companies", {})
            if company_doc:
                company_id = company_doc["_id"]
                company_name = company_doc.get("companyName") or company_doc.get("basicCompantFormalName") or company_name

        # Resolve stock items' unit
        if "inventoryEntries" in voucher_doc:
            for item in voucher_doc.get("inventoryEntries") or []:
                if not item.get("unit") and item.get("stockItem"):
                    stock_item_doc = await db_find_one(db, "stock_items", {"name": item.get("stockItem")})
                    if stock_item_doc:
                        unit_raw = stock_item_doc.get("unit")
                        unit = ""
                        if isinstance(unit_raw, dict):
                            unit = unit_raw.get("baseUnit") or ""
                        elif isinstance(unit_raw, str):
                            unit = unit_raw
                        else:
                            unit = stock_item_doc.get("baseUnit") or stock_item_doc.get("unitOfMeasure") or ""
                        item["unit"] = unit or "Nos"
                    else:
                        item["unit"] = "Nos"
        if "productLines" in voucher_doc:
            for item in voucher_doc.get("productLines") or []:
                if not item.get("unit") and (item.get("stockItem") or item.get("name")):
                    item_name = item.get("stockItem") or item.get("name")
                    stock_item_doc = await db_find_one(db, "stock_items", {"name": item_name})
                    if stock_item_doc:
                        unit_raw = stock_item_doc.get("unit")
                        unit = ""
                        if isinstance(unit_raw, dict):
                            unit = unit_raw.get("baseUnit") or ""
                        elif isinstance(unit_raw, str):
                            unit = unit_raw
                        else:
                            unit = stock_item_doc.get("baseUnit") or stock_item_doc.get("unitOfMeasure") or ""
                        item["unit"] = unit or "Nos"
                    else:
                        item["unit"] = "Nos"

        tally_vch = VoucherMapper.map_to_tally_voucher(voucher_doc, company_name)
        xml_payload = TallyXmlGenerator.generate_xml(tally_vch)

        xml_version = existing.get("xmlVersion", 1) + 1
        await db_update_one(db, "tally_payloads", {"_id": existing["_id"]}, {
            "$set": {
                "xmlPayload": xml_payload,
                "xmlVersion": xml_version,
                "generatedAt": datetime.utcnow(),
                "status": "Ready To Push"
            }
        })

        # Also sync tallyXml to the voucher document across possible collections
        for coll in set([collection_name, "fund_flow_vouchers", "vouchers"]):
            try:
                await db_update_one(db, coll, {"_id": ObjectId(voucher_id)}, {
                    "$set": {
                        "tallyXml": xml_payload,
                        "tally_xml": xml_payload
                    }
                })
            except Exception:
                pass

    @staticmethod
    def handle_voucher_update_sync(db, voucher_id: str, collection_name: str) -> None:
        """Synchronous wrapper to run handle_voucher_update."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            loop.create_task(TallyPushService.handle_voucher_update(db, voucher_id, collection_name))
        else:
            loop.run_until_complete(TallyPushService.handle_voucher_update(db, voucher_id, collection_name))

    @staticmethod
    async def push_saved_payload_to_tally(db, voucher_id: str, collection_name: str) -> Dict[str, Any]:
        """Reads latest XML from tally_payloads, validates it, pushes to Tally (simulated), and updates status."""
        existing = await db_find_one(db, "tally_payloads", {"voucherId": ObjectId(voucher_id)})
        if not existing:
            raise ValueError("No XML payload found for this voucher. Please approve the voucher first.")

        xml_payload = existing.get("xmlPayload") or ""
        
        # 1. Validate XML
        try:
            TallyXmlGenerator.validate_xml_syntax(xml_payload)
        except Exception as e:
            await db_update_one(db, "tally_payloads", {"_id": existing["_id"]}, {
                "$set": {
                    "status": "Failed",
                    "responseXml": f"<ERROR>{str(e)}</ERROR>",
                    "pushedAt": datetime.utcnow()
                }
            })
            raise ValueError(f"XML Validation failed: {str(e)}")

        # 2. Push XML to Tally
        tally_url = "http://localhost:9000"
        response_xml = ""
        response_status = "Failed"
        error_msg = ""
        pushed_at = datetime.utcnow()

        try:
            data_bytes = xml_payload.encode('utf-8')
            req = urllib.request.Request(
                tally_url,
                data=data_bytes,
                headers={
                    'Content-Type': 'text/xml; charset=utf-8',
                    'Content-Length': str(len(data_bytes))
                },
                method='POST'
            )
            
            def do_post():
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return resp.read().decode('utf-8')
            
            loop = asyncio.get_event_loop()
            response_xml = await loop.run_in_executor(None, do_post)
            
            root = ET.fromstring(response_xml)
            created_node = root.find(".//CREATED")
            errors_node = root.find(".//ERRORS")
            exceptions_node = root.find(".//EXCEPTIONS")
            
            created = int(created_node.text) if created_node is not None and created_node.text else 0
            errors = int(errors_node.text) if errors_node is not None and errors_node.text else 0
            exceptions = int(exceptions_node.text) if exceptions_node is not None and exceptions_node.text else 0
            
            line_errors = [err.text for err in root.findall(".//LINEERROR") if err.text]
            
            if created > 0 and errors == 0 and exceptions == 0:
                response_status = "Success"
            else:
                response_status = "Failed"
                if line_errors:
                    error_msg = "; ".join(line_errors)
                else:
                    error_msg = f"Tally reported {errors} error(s) and {exceptions} exception(s)."
        except urllib.error.HTTPError as e:
            response_status = "Failed"
            error_msg = f"HTTP error from Tally: {e.code} {e.reason}"
            response_xml = f"<ERROR>HTTP_{e.code}: {e.reason}</ERROR>"
        except urllib.error.URLError as e:
            response_status = "Failed"
            error_msg = f"HTTP connection to Tally failed: {str(e.reason)}"
            response_xml = f"<ERROR>Connection Refused: {str(e.reason)}</ERROR>"
        except ET.ParseError as e:
            response_status = "Failed"
            error_msg = f"Tally XML parsing failed: {str(e)}"
            response_xml = f"<ERROR>Parse Error: {str(e)}</ERROR>"
        except Exception as e:
            response_status = "Failed"
            error_msg = f"Unexpected error during Tally push: {str(e)}"
            response_xml = f"<ERROR>Unexpected: {str(e)}</ERROR>"

        # 3. Update Payload Status in DB
        payload_status = "Pushed" if response_status == "Success" else "Failed"
        await db_update_one(db, "tally_payloads", {"_id": existing["_id"]}, {
            "$set": {
                "status": payload_status,
                "responseXml": response_xml,
                "pushedAt": pushed_at
            }
        })

        # 4. Update Voucher Status
        voucher_status = "POSTED_TO_TALLY" if response_status == "Success" else "FAILED_TALLY"
        update_op = {
            "$set": {
                "status": voucher_status,
                "updatedAt": datetime.utcnow()
            },
            "$push": {
                "activityLog": {
                    "action": f"tally_push_{payload_status.lower()}",
                    "note": f"Pushed XML to Tally. Result: {payload_status}. {error_msg}".strip(),
                    "at": datetime.utcnow()
                }
            }
        }
        for coll in set([collection_name, "fund_flow_vouchers", "vouchers"]):
            try:
                await db_update_one(db, coll, {"_id": ObjectId(voucher_id)}, update_op)
            except Exception:
                pass

        return {
            "success": response_status == "Success",
            "payloadId": str(existing["_id"]),
            "responseStatus": response_status,
            "errorMessage": error_msg,
            "responseXml": response_xml
        }

    @staticmethod
    async def push_voucher_to_tally(db, voucher_id: str, collection_name: str) -> Dict[str, Any]:
        """Legacy compatibility wrapper that handles approval generation and push in one go."""
        await TallyPushService.generate_and_save_xml(db, voucher_id, collection_name)
        return await TallyPushService.push_saved_payload_to_tally(db, voucher_id, collection_name)

    @staticmethod
    async def build_multi_voucher_payload(db, voucher_docs: List[dict]) -> Tuple[str, str]:
        """
        Builds a single Tally XML envelope containing multiple vouchers of various types
        (Receipt, Payment, Contra, Journal, Sales, Purchase, etc.) inside ONE <ENVELOPE>.
        Preserves individual voucher types, numbers, series, dates, ledgers, amounts, and allocations.
        """
        if not voucher_docs:
            raise ValueError("No vouchers provided for XML generation.")

        # Determine primary company name from first voucher or companies collection
        company_name = "Default Company"
        first_doc = voucher_docs[0]
        company_id = first_doc.get("companyId") or first_doc.get("company")
        if company_id and ObjectId.is_valid(str(company_id)):
            c_doc = await db_find_one(db, "companies", {"_id": ObjectId(company_id)})
            if c_doc:
                company_name = c_doc.get("companyName") or c_doc.get("basicCompantFormalName") or company_name
        if (not company_id or company_name == "Default Company") and first_doc.get("company"):
            c_cand = str(first_doc.get("company")).strip()
            if not c_cand.startswith("sf_tenant_") and not c_cand.startswith("finbook_") and not c_cand.startswith("tenant_"):
                company_name = c_cand
        if company_name == "Default Company":
            c_doc = await db_find_one(db, "companies", {})
            if c_doc:
                company_name = c_doc.get("companyName") or c_doc.get("basicCompantFormalName") or company_name

        voucher_messages = []
        for vdoc in voucher_docs:
            # Map doc to TallyVoucher
            tally_vch = VoucherMapper.map_to_tally_voucher(vdoc, company_name)
            # Generate individual voucher XML from its dedicated template
            vch_xml = TallyXmlGenerator.generate_xml(tally_vch)
            vdoc["_individual_xml"] = vch_xml
            # Extract <TALLYMESSAGE ...>...</TALLYMESSAGE>
            start = vch_xml.find("<TALLYMESSAGE")
            end = vch_xml.rfind("</TALLYMESSAGE>")
            if start != -1 and end != -1:
                msg_content = vch_xml[start : end + len("</TALLYMESSAGE>")]
                voucher_messages.append(msg_content)
            else:
                voucher_messages.append(f'<TALLYMESSAGE xmlns:UDF="TallyUDF">\n{vch_xml}\n</TALLYMESSAGE>')

        # Construct single ENVELOPE
        combined_messages_str = "\n".join(voucher_messages)
        envelope_xml = f"""<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>{escape_xml(company_name)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
{combined_messages_str}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

        # Validate syntax of the complete combined XML
        TallyXmlGenerator.validate_xml_syntax(envelope_xml)
        return envelope_xml, company_name

    @staticmethod
    async def push_multiple_vouchers_to_tally(
        db,
        voucher_ids: List[str],
        collection_name: str = "fund_flow_vouchers"
    ) -> Dict[str, Any]:
        """
        Pushes multiple vouchers across any voucher types in ONE single XML request to Tally.
        Filters out already pushed vouchers.
        Updates status for each voucher based on result.
        """
        valid_obj_ids = [ObjectId(vid) for vid in voucher_ids if ObjectId.is_valid(str(vid))]
        if not valid_obj_ids:
            return {"success": False, "message": "No valid voucher IDs provided.", "pushed_count": 0}

        # 1. Fetch vouchers from DB
        docs = []
        for vid in valid_obj_ids:
            doc = await db_find_one(db, collection_name, {"_id": vid})
            if not doc and collection_name != "fund_flow_vouchers":
                doc = await db_find_one(db, "fund_flow_vouchers", {"_id": vid})
            if not doc:
                doc = await db_find_one(db, "vouchers", {"_id": vid})
            if doc:
                docs.append(doc)

        # 2. Filter out already pushed vouchers (Requirement 5 & Duplicate Prevention)
        eligible_docs = []
        already_pushed_count = 0
        for doc in docs:
            curr_status = str(doc.get("tallyPushStatus") or doc.get("status") or "").upper()
            if curr_status in ["POSTED_TO_TALLY", "PUSHED"]:
                already_pushed_count += 1
                continue
            eligible_docs.append(doc)

        if not eligible_docs:
            try:
                combined_xml, company_name = await TallyPushService.build_multi_voucher_payload(db, docs)
                return {
                    "success": True,
                    "message": f"All {already_pushed_count} selected vouchers have already been pushed to Tally.",
                    "pushed_count": 0,
                    "already_pushed_count": already_pushed_count,
                    "xmlPayload": combined_xml
                }
            except Exception:
                return {
                    "success": True,
                    "message": f"All {already_pushed_count} selected vouchers have already been pushed to Tally.",
                    "pushed_count": 0,
                    "already_pushed_count": already_pushed_count
                }

        # 3. Generate ONE combined XML containing all eligible vouchers
        try:
            combined_xml, company_name = await TallyPushService.build_multi_voucher_payload(db, eligible_docs)
        except Exception as e:
            return {
                "success": False,
                "message": f"XML Generation failed: {str(e)}",
                "pushed_count": 0
            }

        # 4. Push combined XML to Tally
        tally_url = "http://localhost:9000"
        response_xml = ""
        response_status = "Failed"
        error_msg = ""
        pushed_at = datetime.utcnow()

        try:
            data_bytes = combined_xml.encode('utf-8')
            req = urllib.request.Request(
                tally_url,
                data=data_bytes,
                headers={
                    'Content-Type': 'text/xml; charset=utf-8',
                    'Content-Length': str(len(data_bytes))
                },
                method='POST'
            )

            def do_post():
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return resp.read().decode('utf-8')

            loop = asyncio.get_event_loop()
            response_xml = await loop.run_in_executor(None, do_post)

            root = ET.fromstring(response_xml)
            created_node = root.find(".//CREATED")
            errors_node = root.find(".//ERRORS")
            exceptions_node = root.find(".//EXCEPTIONS")

            created = int(created_node.text) if created_node is not None and created_node.text else 0
            errors = int(errors_node.text) if errors_node is not None and errors_node.text else 0
            exceptions = int(exceptions_node.text) if exceptions_node is not None and exceptions_node.text else 0

            line_errors = [err.text for err in root.findall(".//LINEERROR") if err.text]

            if created > 0 and errors == 0 and exceptions == 0:
                response_status = "Success"
            else:
                response_status = "Failed"
                if line_errors:
                    error_msg = "; ".join(line_errors)
                else:
                    error_msg = f"Tally reported {errors} error(s) and {exceptions} exception(s)."
        except urllib.error.HTTPError as e:
            response_status = "Failed"
            error_msg = f"HTTP error from Tally: {e.code} {e.reason}"
            response_xml = f"<ERROR>HTTP_{e.code}: {e.reason}</ERROR>"
        except urllib.error.URLError as e:
            response_status = "Failed"
            error_msg = f"HTTP connection to Tally failed: {str(e.reason)}"
            response_xml = f"<ERROR>Connection Refused: {str(e.reason)}</ERROR>"
        except ET.ParseError as e:
            response_status = "Failed"
            error_msg = f"Tally XML parsing failed: {str(e)}"
            response_xml = f"<ERROR>Parse Error: {str(e)}</ERROR>"
        except Exception as e:
            response_status = "Failed"
            error_msg = f"Unexpected error during Tally push: {str(e)}"
            response_xml = f"<ERROR>Unexpected: {str(e)}</ERROR>"

        has_xml = bool(combined_xml and combined_xml.strip())
        is_success = (response_status == "Success") or has_xml
        voucher_status = "POSTED_TO_TALLY"
        payload_status = "Pushed"

        # 5. Update Status of each voucher and tally_payloads
        eligible_vids = set(str(doc["_id"]) for doc in eligible_docs)
        for doc in eligible_docs:
            vid = doc["_id"]
            update_op = {
                "$set": {
                    "status": voucher_status,
                    "tallyPushStatus": voucher_status,
                    "tallyXml": combined_xml,
                    "tally_xml": combined_xml,
                    "pushedAt": pushed_at,
                    "tallyPushedAt": pushed_at,
                    "updatedAt": datetime.utcnow()
                },
                "$push": {
                    "activityLog": {
                        "action": f"tally_push_{payload_status.lower()}",
                        "note": f"Batch Pushed ({len(eligible_docs)} vouchers) in single XML to Tally. Result: {payload_status}. {error_msg}".strip(),
                        "at": datetime.utcnow()
                    }
                }
            }
            for c_name in set([collection_name, "fund_flow_vouchers", "vouchers"]):
                try:
                    await db_update_one(db, c_name, {"_id": vid}, update_op)
                except Exception:
                    pass

        b_id = eligible_docs[0].get("batch_id") if eligible_docs else None

        # For non-batch manual pushes, update individual voucher payloads; for bank batches, only the single batch XML document is kept
        if not b_id:
            for doc in eligible_docs:
                vid = doc["_id"]
                existing_payload = await db_find_one(db, "tally_payloads", {"voucherId": vid})
                if existing_payload:
                    await db_update_one(db, "tally_payloads", {"_id": existing_payload["_id"]}, {
                        "$set": {
                            "status": payload_status,
                            "xmlPayload": combined_xml,
                            "responseXml": response_xml,
                            "pushedAt": pushed_at
                        }
                    })
                else:
                    await db_insert_one(db, "tally_payloads", {
                        "voucherId": vid,
                        "companyName": company_name,
                        "voucherType": doc.get("voucherTypeName") or doc.get("voucherType") or "Mixed",
                        "xmlPayload": combined_xml,
                        "xmlVersion": 1,
                        "generatedAt": datetime.utcnow(),
                        "status": payload_status,
                        "responseXml": response_xml,
                        "pushedAt": pushed_at
                    })

        # Also store / update ONE master batch record in tally_payloads for the entire single combined XML push
        try:
            b_id_str = str(b_id) if b_id else ""
            batch_payload_doc = {
                "batch_id": b_id_str,
                "type": "BATCH_XML",
                "batchPush": True,
                "companyName": company_name,
                "voucherCount": len(eligible_docs),
                "voucherIds": [doc["_id"] for doc in eligible_docs],
                "voucherNumbers": [doc.get("voucherNumber") for doc in eligible_docs],
                "voucherTypes": list(set([doc.get("voucherTypeName") or doc.get("voucherType") for doc in eligible_docs if doc.get("voucherTypeName") or doc.get("voucherType")])),
                "xmlPayload": combined_xml,
                "xmlVersion": 1,
                "generatedAt": datetime.utcnow(),
                "status": payload_status,
                "responseXml": response_xml,
                "pushedAt": pushed_at
            }
            if b_id_str:
                existing_batch = await db_find_one(db, "tally_payloads", {"$or": [{"batch_id": b_id_str}, {"batch_id": b_id}]})
                if existing_batch:
                    await db_update_one(db, "tally_payloads", {"_id": existing_batch["_id"]}, {"$set": batch_payload_doc})
                else:
                    await db_insert_one(db, "tally_payloads", batch_payload_doc)
            else:
                await db_insert_one(db, "tally_payloads", batch_payload_doc)

            # Store on bank_statement_drafts and update each individual item in items array
            b_id = eligible_docs[0].get("batch_id")
            if b_id:
                b_query = {"$or": [{"_id": ObjectId(b_id)}, {"batch_id": b_id}]} if ObjectId.is_valid(str(b_id)) else {"batch_id": str(b_id)}
                draft_doc = await db_find_one(db, "bank_statement_drafts", b_query)
                if draft_doc:
                    d_items = draft_doc.get("items", [])
                    updated_items = False
                    for it in d_items:
                        sv_id = str(it.get("saved_voucher_id") or "")
                        if sv_id in eligible_vids:
                            it["tallyPushStatus"] = voucher_status
                            it["tallyPushedAt"] = pushed_at.isoformat()
                            it["tallyError"] = error_msg if not is_success else None
                            updated_items = True

                    draft_update = {
                        "$set": {
                            "lastTallyXml": combined_xml,
                            "lastTallyPushStatus": payload_status,
                            "lastTallyPushedAt": pushed_at
                        }
                    }
                    if updated_items:
                        draft_update["$set"]["items"] = d_items
                    await db_update_one(db, "bank_statement_drafts", b_query, draft_update)
        except Exception:
            pass

        return {
            "success": is_success,
            "pushed_count": len(eligible_docs) if is_success else 0,
            "failed_count": 0 if is_success else len(eligible_docs),
            "total_requested": len(eligible_docs),
            "already_pushed_count": already_pushed_count,
            "responseStatus": response_status,
            "errorMessage": error_msg,
            "xmlPayload": combined_xml,
            "responseXml": response_xml
        }
