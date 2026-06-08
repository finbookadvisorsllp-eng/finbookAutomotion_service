from fastapi import Request
from pymongo import MongoClient
import re
import threading
from app.config import settings

# Initialize MongoClient
client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)

# In-memory cache for resolving company references to database names.
# Pre-populate with default company mapping to avoid blocking first requests/refresh.
_tenant_cache = {
    "6a182ee36efd32db3c490a6c": "sf_tenant_6a182ee36efd32db3c490a6c",
    "Friends Grafix FY 2024-25": "sf_tenant_6a182ee36efd32db3c490a6c",
    "Friends Grafix": "sf_tenant_6a182ee36efd32db3c490a6c"
}
_cache_warmed = False

def _warm_up_worker():
    global _cache_warmed
    try:
        # 1. Warm up organizations
        orgs = client["salesforecasting_system"]["organizations"].find({}, {"slug": 1, "name": 1, "dbName": 1})
        for org in orgs:
            db_name = org.get("dbName") or f"sf_tenant_{str(org['_id'])}"
            if org.get("slug"):
                _tenant_cache[org["slug"].strip()] = db_name
            if org.get("name"):
                _tenant_cache[org["name"].strip()] = db_name
                
        # 2. Warm up company names from sf_tenant_* databases
        all_dbs = client.list_database_names()
        for db_name in all_dbs:
            if db_name.startswith("sf_tenant_"):
                # Ensure indexes on dynamic collections
                try:
                    db = client[db_name]
                    db["sales_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
                    db["sales_transactions"].create_index([("createdAt", -1)])
                    db["purchase_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
                    db["purchase_transactions"].create_index([("createdAt", -1)])
                    db["fund_flow_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
                    db["fund_flow_transactions"].create_index([("createdAt", -1)])
                    db["ledgers"].create_index([("groupName", 1)])
                    db["ledgers"].create_index([("ledgerName", 1)])
                except Exception as ex:
                    print(f"Error ensuring indexes for {db_name}: {ex}")

                try:
                    companies = client[db_name]["companies"].find({}, {"companyName": 1, "basicCompantFormalName": 1})
                    for comp in companies:
                        c_name = comp.get("companyName")
                        f_name = comp.get("basicCompantFormalName")
                        if c_name:
                            _tenant_cache[c_name.strip()] = db_name
                        if f_name:
                            _tenant_cache[f_name.strip()] = db_name
                except Exception:
                    pass
        _cache_warmed = True
        print("Tenant cache warming and indexing completed successfully in background.")
    except Exception as e:
        print(f"Error warming up tenant cache in background: {e}")

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
    Dynamically resolves the database name based on a company ID, slug, or name.
    """
    if not company_ref:
        return settings.DEFAULT_DB_NAME
        
    company_ref = company_ref.strip()
    
    # 1. Check if the reference is already cached (includes negative results)
    if company_ref in _tenant_cache:
        return _tenant_cache[company_ref]
        
    # 2. Check if the reference is a 24-character hex string (standard MongoDB ObjectId)
    if len(company_ref) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_ref):
        db_name = f"sf_tenant_{company_ref.lower()}"
        _tenant_cache[company_ref] = db_name
        return db_name

    # Quick check to ignore common placeholders / undefined / null references
    if company_ref.lower() in ("undefined", "null", "default", "main company ltd", "subsidiary pvt ltd", ""):
        _tenant_cache[company_ref] = settings.DEFAULT_DB_NAME
        return settings.DEFAULT_DB_NAME

    # 3. Check salesforecasting_system.organizations for slug or name match
    try:
        org_doc = client["salesforecasting_system"]["organizations"].find_one({
            "$or": [
                {"slug": company_ref},
                {"name": company_ref}
            ]
        })
        if org_doc:
            db_name = org_doc.get("dbName") or f"sf_tenant_{str(org_doc['_id'])}"
            _tenant_cache[company_ref] = db_name
            return db_name
    except Exception:
        pass

    # 4. Scan all sf_tenant_* databases for a matching companyName (only if cache is not fully warmed)
    if not _cache_warmed:
        try:
            all_dbs = client.list_database_names()
            for db_name in all_dbs:
                if db_name.startswith("sf_tenant_"):
                    comp_doc = client[db_name]["companies"].find_one({
                        "$or": [
                            {"companyName": company_ref},
                            {"basicCompantFormalName": company_ref}
                        ]
                    })
                    if comp_doc:
                        _tenant_cache[company_ref] = db_name
                        return db_name
        except Exception:
            pass

    # Fallback to the default database name and cache it to prevent subsequent heavy scans
    _tenant_cache[company_ref] = settings.DEFAULT_DB_NAME
    return settings.DEFAULT_DB_NAME

def get_db(request: Request):
    """
    FastAPI dependency that dynamically extracts the tenant company from headers
    and returns the corresponding dynamic MongoDB database.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    db_name = resolve_db_name(company_header)
    return client[db_name]

