from fastapi import APIRouter, Depends
from app.anjalee.schemas.auth_schemas import LoginRequest, LoginResponse
from app.anjalee.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service() -> AuthService:
    return AuthService()

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, service: AuthService = Depends(get_auth_service)):
    """
    Standard authentication endpoint.
    Delegates credentials check to the AuthService.
    """
    return service.authenticate_user(payload)
