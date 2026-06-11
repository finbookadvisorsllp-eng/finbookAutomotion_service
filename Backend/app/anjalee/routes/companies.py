from fastapi import APIRouter, Depends
from typing import List
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
async def get_current_company_master_data(service: CompanyService = Depends(get_company_service)):
    """
    Fetch master data dynamically for the current company.
    """
    master_data = service.get_company_master_data()
    return {
        "success": True,
        "data": master_data
    }
