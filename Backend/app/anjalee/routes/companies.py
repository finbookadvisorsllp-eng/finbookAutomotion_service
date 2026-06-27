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

@router.get("", response_model=List[CompanyResponse])
async def list_companies(service: CompanyService = Depends(get_company_service)):
    """
    List companies from the database.
    """
    return service.list_companies()

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
    master_data = service.get_company_master_data(company_id=company_header)
    return {
        "success": True,
        "data": master_data
    }

@router.get("/current/dashboard-summary")
async def get_current_company_dashboard_summary(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    partyLedger: Optional[str] = Query(None),
    service: CompanyService = Depends(get_company_service)
):
    """
    Fetch dashboard summary and party ledger details dynamically for the current company.
    """
    summary_data = service.get_company_dashboard_summary(
        start_date_str=startDate, 
        end_date_str=endDate,
        party_ledger=partyLedger
    )
    return {
        "success": True,
        "data": summary_data
    }

