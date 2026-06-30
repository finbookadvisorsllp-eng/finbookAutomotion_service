import os
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
import asyncio
from bson import ObjectId
import inspect
from typing import Dict, Any, Optional

from app.anjalee.services.tally.voucher_mapper import VoucherMapper
from app.anjalee.services.tally.xml_generator import TallyXmlGenerator

async def db_find_one(db, collection: str, query: dict) -> Optional[Dict[str, Any]]:
    res = db[collection].find_one(query)
    if inspect.isawaitable(res):
        return await res
    return res

async def db_insert_one(db, collection: str, doc: dict) -> Any:
    res = db[collection].insert_one(doc)
    if inspect.isawaitable(res):
        inserted = await res
        return inserted.inserted_id
    return res.inserted_id

async def db_update_one(db, collection: str, query: dict, update: dict) -> Any:
    res = db[collection].update_one(query, update)
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
        await db_update_one(db, collection_name, {"_id": ObjectId(voucher_id)}, update_op)

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
