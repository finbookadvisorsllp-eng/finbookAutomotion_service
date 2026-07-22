from fastapi import Request
from pymongo import MongoClient
import re
import threading
from app.config import settings

# Module-level constants exported for use by other modules (e.g. bulk_upload background worker)
MONGO_URI: str = settings.MONGO_URI
DB_NAME: str = settings.DEFAULT_DB_NAME

# Initialize MongoClient
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

# Dynamic in-memory cache for resolving organization IDs and company references to tenant database names.
_tenant_cache = {}
_cache_warmed = False

REQUIRED_TENANT_COLLECTIONS = [
    "sales_vouchers",
    "purchase_vouchers",
    "fund_flow_vouchers",
    "vouchers",
    "ledgers",
    "companies",
    "stockItems",
    "voucherTypes",
    "costCenters",
    "counters",
    "bulk_uploads",
    "ocr_data",
    "layouts",
    "ai_extractions",
    "validations",
    "reviews",
    "audit_logs",
    "attachments",
    "notifications",
    "settings"
]

def ensure_tenant_db_structure(db):
    """
    Ensures that ALL required project collections exist for the tenant database
    (excluding legacy *_transactions collections) and creates necessary indexes.
    """
    from pymongo.errors import OperationFailure

    # 1. Pre-create all required tenant collections (excluding all *_transactions)
    try:
        existing = set(db.list_collection_names())
        for coll_name in REQUIRED_TENANT_COLLECTIONS:
            if coll_name not in existing:
                try:
                    db.create_collection(coll_name)
                except Exception:
                    pass
    except Exception as e:
        print(f"Error pre-creating tenant collections: {e}")

    # 2. Ensure indexes on voucher and master collections
    configs = [
        ("sales_vouchers", [("voucherType", 1), ("status", 1), ("createdAt", -1)], {}),
        ("sales_vouchers", [("createdAt", -1)], {}),
        ("purchase_vouchers", [("voucherType", 1), ("status", 1), ("createdAt", -1)], {}),
        ("purchase_vouchers", [("createdAt", -1)], {}),
        ("fund_flow_vouchers", [("voucherType", 1), ("status", 1), ("createdAt", -1)], {}),
        ("fund_flow_vouchers", [("createdAt", -1)], {}),
        ("vouchers", [("voucherTypeName", 1), ("dates.date", -1)], {}),
        ("ledgers", [("groupName", 1)], {}),
        ("ledgers", [("ledgerName", 1)], {}),
        ("stockItems", [("itemName", 1)], {}),
        ("bulk_uploads", [("upload_date", -1)], {}),
        ("ocr_data", [("document_id", 1)], {}),
        ("layouts", [("document_id", 1)], {}),
        ("ai_extractions", [("document_id", 1)], {}),
        ("validations", [("document_id", 1)], {}),
        ("reviews", [("document_id", 1)], {}),
    ]

    for coll_name, keys, options in configs:
        try:
            db[coll_name].create_index(keys, **options)
        except OperationFailure as ex:
            if ex.code == 85:
                continue
            print(f"Error ensuring index on {coll_name} for keys {keys}: {ex}")
        except Exception as ex:
            print(f"Error ensuring index on {coll_name} for keys {keys}: {ex}")

def ensure_db_indexes(db):
    ensure_tenant_db_structure(db)

def _warm_up_worker():
    global _cache_warmed
    try:
        # Dynamically warm up tenant cache from IAM organizations collection
        orgs = client["iam"]["organizations"].find({}, {"_id": 1, "slug": 1, "name": 1, "displayName": 1, "dbName": 1})
        for org in orgs:
            org_id_str = str(org["_id"])
            db_name = org.get("dbName") or f"finbook_tenant_{org_id_str}"
            _tenant_cache[org_id_str] = db_name
            if org.get("slug"):
                _tenant_cache[org["slug"].strip()] = db_name
            if org.get("name"):
                _tenant_cache[org["name"].strip()] = db_name
            if org.get("displayName"):
                _tenant_cache[org["displayName"].strip()] = db_name
        _cache_warmed = True
        print("Dynamic IAM tenant cache warming completed successfully.")
    except Exception as e:
        print(f"Error warming up IAM tenant cache in background: {e}")

def warm_up_tenant_cache():
    """
    Spawns a background thread to warm up the tenant cache,
    preventing blocking the FastAPI startup event and causing slow page loads.
    """
    global _cache_warmed
    if _cache_warmed:
        return
    
    # Start the worker thread
    thread = threading.Thread(target=_warm_up_worker, daemon=True)
    thread.start()

def resolve_db_name(company_ref: str) -> str:
    """
    Dynamically resolves the dedicated database name for an organization.
    Queries IAM MongoDB collection 'organizations' and ensures
    newly created or mapped organizations route to their designated local database.
    """
    if not company_ref:
        return settings.DEFAULT_DB_NAME
        
    company_ref = str(company_ref).strip()
    if company_ref.lower() in ("undefined", "null", ""):
        return settings.DEFAULT_DB_NAME

    from bson import ObjectId

    # 1. Directly query MongoDB 'iam.organizations' for latest 'dbName' mapping
    try:
        iam_db = client["iam"]
        query_conditions = [
            {"slug": company_ref},
            {"name": company_ref},
            {"displayName": company_ref}
        ]
        if len(company_ref) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_ref):
            try:
                query_conditions.append({"_id": ObjectId(company_ref)})
            except Exception:
                pass

        org_doc = iam_db["organizations"].find_one({"$or": query_conditions})
        if org_doc and org_doc.get("dbName"):
            db_name = str(org_doc.get("dbName")).strip()
            _tenant_cache[company_ref] = db_name
            if org_doc.get("_id"): _tenant_cache[str(org_doc["_id"])] = db_name
            if org_doc.get("slug"): _tenant_cache[org_doc["slug"].strip()] = db_name
            if org_doc.get("name"): _tenant_cache[org_doc["name"].strip()] = db_name
            return db_name
    except Exception as e:
        print(f"Error resolving tenant DB in IAM: {e}")

    # 2. Check in-memory tenant cache if not specified in DB doc
    if company_ref in _tenant_cache:
        return _tenant_cache[company_ref]

    # 3. If reference is a 24-char ObjectId, assign fallback isolated tenant database name
    if len(company_ref) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_ref):
        db_name = f"tenant_{company_ref.lower()}"
        _tenant_cache[company_ref] = db_name
        return db_name

    # 4. If slug or name is unknown, assign isolated tenant database name
    clean_slug = re.sub(r'[^a-z0-9]+', '_', company_ref.lower()).strip('_') or "tenant"
    db_name = f"tenant_{clean_slug}"
    _tenant_cache[company_ref] = db_name
    return db_name

_indexed_dbs = set()

def extract_company_ref_from_request(request: Request) -> str:
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    if not company_header:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_token
                token = auth_header.split(" ")[1]
                claims = decode_token(token)
                company_header = claims.get("orgId") or claims.get("companyId")
            except Exception:
                pass
    return company_header or ""

def get_db(request: Request):
    """
    FastAPI dependency that dynamically extracts the tenant company from headers/JWT
    and returns the corresponding dedicated tenant MongoDB database.
    """
    company_ref = extract_company_ref_from_request(request)
    db_name = resolve_db_name(company_ref)
    
    if db_name not in _indexed_dbs:
        _indexed_dbs.add(db_name)
        threading.Thread(target=ensure_db_indexes, args=(client[db_name],), daemon=True).start()
        
    return client[db_name]


# Change by Anjalee: Add async motor client and FastAPI dependency for dynamic database mapping
from motor.motor_asyncio import AsyncIOMotorClient

async_client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)

async def get_async_db(request: Request):
    """
    FastAPI dependency that dynamically extracts the tenant company from headers/JWT
    and returns the corresponding dedicated tenant MongoDB database using Motor.
    """
    company_ref = extract_company_ref_from_request(request)
    db_name = resolve_db_name(company_ref)
    
    if db_name not in _indexed_dbs:
        _indexed_dbs.add(db_name)
        threading.Thread(target=ensure_db_indexes, args=(client[db_name],), daemon=True).start()
        
    return async_client[db_name]


