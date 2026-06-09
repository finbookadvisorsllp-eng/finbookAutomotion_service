from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.db import get_db
from app.anjalee.repositories.fundflow_repo import FundFlowRepository
from app.anjalee.services.fundflow_service import FundFlowService
from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate, StatusUpdate, CommentRequest

router = APIRouter(prefix="/fundflow", tags=["fundflow"])

def get_fundflow_service(db = Depends(get_db)) -> FundFlowService:
    repo = FundFlowRepository(db)
    return FundFlowService(repo)

@router.get("/stats")
async def get_summary_stats(
    voucherType: str = "bank_payment",
    companyId: Optional[str] = None,
    service: FundFlowService = Depends(get_fundflow_service)
):
    stats = service.get_summary_stats(voucherType, companyId)
    return {
        "success": True,
        "data": stats
    }

@router.get("")
async def list_transactions(
    voucherType: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    service: FundFlowService = Depends(get_fundflow_service)
):
    result = service.list_transactions(
        voucher_type=voucherType,
        status=status,
        search=search,
        page=page,
        limit=limit
    )
    return {
        "success": True,
        "data": result["results"],
        "pagination": {
            "total": result["total"],
            "page": page,
            "limit": limit
        }
    }

@router.post("")
async def create_transaction(
    payload: FundFlowTransactionCreate,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.create_transaction(payload)
    return {
        "success": True,
        "data": data
    }

@router.get("/{id}")
async def get_transaction(
    id: str,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.get_transaction(id)
    return {
        "success": True,
        "data": data
    }

@router.put("/{id}")
async def update_transaction(
    id: str,
    payload: FundFlowTransactionCreate,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.update_transaction(id, payload)
    return {
        "success": True,
        "data": data
    }

@router.delete("/{id}")
async def delete_transaction(
    id: str,
    service: FundFlowService = Depends(get_fundflow_service)
):
    service.delete_transaction(id)
    return {
        "success": True,
        "message": "Transaction deleted successfully"
    }

@router.patch("/{id}/status")
async def update_status(
    id: str,
    payload: StatusUpdate,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.update_status(id, payload)
    return {
        "success": True,
        "data": data
    }

@router.post("/{id}/comments")
async def add_comment(
    id: str,
    payload: CommentRequest,
    service: FundFlowService = Depends(get_fundflow_service)
):
    service.add_comment(id, payload)
    return {
        "success": True,
        "message": "Comment added successfully"
    }
