from fastapi import HTTPException, status
from app.anjalee.schemas.auth_schemas import LoginRequest, LoginResponse

class AuthService:
    def authenticate_user(self, payload: LoginRequest) -> dict:
        # Business logic for auth stub
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
