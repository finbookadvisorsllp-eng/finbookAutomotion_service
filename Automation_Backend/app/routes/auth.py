from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    # Standard authentication stub for development/testing
    if payload.email and payload.password:
        return {
            "token": "dev-stub-token",
            "user": {
                "email": payload.email,
                "name": payload.email.split("@")[0].capitalize()
            }
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )
