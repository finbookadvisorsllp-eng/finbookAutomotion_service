from fastapi import APIRouter, Depends, Query, Request
from typing import List, Optional
from app.db import get_db
from app.anjalee.repositories.company_repo import CompanyRepository
from app.anjalee.services.company_service import CompanyService
from app.anjalee.schemas.company_schemas import CompanyResponse, CreateCompanyRequest

router = APIRouter(prefix="/companies", tags=["companies"])

def get_company_service(db = Depends(get_db)) -> CompanyService:
    repo = CompanyRepository(db)
    return CompanyService(repo)

from app.core.iam_db import get_async_iam_db

@router.get("")
async def list_companies(
    request: Request,
    service: CompanyService = Depends(get_company_service)
):
    """
    List companies dynamically from IAM 'organizations' collection, strictly scoped to current user's organization.
    """
    allowed_org_ids = set()
    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company")

    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.core.security import decode_token
            from app.core.iam_service import get_user_by_id
            token = auth_header.split(" ")[1]
            claims = decode_token(token)
            user_id = claims.get("sub")
            if not active_org_id:
                active_org_id = claims.get("orgId") or claims.get("companyId")
            
            if user_id:
                user_doc = await get_user_by_id(user_id)
                if user_doc:
                    orgs = user_doc.get("organizations") or user_doc.get("companyIds") or []
                    allowed_org_ids = {str(o) for o in orgs if o}
        except Exception:
            pass

    if active_org_id:
        allowed_org_ids.add(str(active_org_id))

    result = []
    try:
        db = await get_async_iam_db()
        cursor = db["organizations"].find({})
        async for org in cursor:
            org_id = str(org["_id"])
            org_name = org.get("displayName") or org.get("name") or org.get("companyName")
            if org_name:
                result.append({
                    "id": org_id,
                    "name": org_name,
                    "gstin": org.get("gstNo") or org.get("gstin") or "N/A",
                    "createdAt": str(org.get("createdAt", ""))
                })
    except Exception as e:
        print(f"Error fetching IAM organizations: {e}")

    # Fallback to main db companies collection only if result is empty
    if not result:
        raw_companies = service.list_companies() or []
        for c in raw_companies:
            c_id = str(c.get("id") if isinstance(c, dict) else getattr(c, "id", ""))
            c_name = c.get("name") if isinstance(c, dict) else getattr(c, "name", "")
            c_gstin = (c.get("gstin") if isinstance(c, dict) else getattr(c, "gstin", None)) or "N/A"
            c_created = str(c.get("createdAt") if isinstance(c, dict) else getattr(c, "createdAt", ""))
            if c_name:
                result.append({
                    "id": c_id,
                    "name": c_name,
                    "gstin": c_gstin,
                    "createdAt": c_created
                })

    # Apply strict organization scoping: show ONLY active organization if set, else allowed organization(s)
    if active_org_id:
        active_match = [r for r in result if r["id"] == str(active_org_id)]
        if active_match:
            return active_match

    if allowed_org_ids:
        filtered_result = [r for r in result if r["id"] in allowed_org_ids]
        return filtered_result

    return result

@router.post("", response_model=CompanyResponse)
async def create_company(payload: CreateCompanyRequest, service: CompanyService = Depends(get_company_service)):
    """
    Create a new company.
    """
    return service.create_company(payload)

@router.get("/current/master-data")
async def get_current_company_master_data(
    request: Request,
    service: CompanyService = Depends(get_company_service)
):
    """
    Fetch master data dynamically for the current company.
    """
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
    master_data = service.get_company_master_data(company_id=company_header)
    return {
        "success": True,
        "data": master_data
    }

@router.get("/current/dashboard-summary")
async def get_current_company_dashboard_summary(
    request: Request,
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    partyLedger: Optional[str] = Query(None),
    service: CompanyService = Depends(get_company_service)
):
    """
    Fetch dashboard summary and party ledger details dynamically for the current company.
    """
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

    summary_data = service.get_company_dashboard_summary(
        start_date_str=startDate, 
        end_date_str=endDate,
        party_ledger=partyLedger,
        company_id=company_header
    )
    return {
        "success": True,
        "data": summary_data
    }

