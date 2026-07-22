from fastapi import HTTPException, status
from app.anjalee.schemas.auth_schemas import LoginRequest

class AuthService:
    def authenticate_user(self, payload: LoginRequest) -> dict:
        """
        Legacy mock authentication service.
        Deprecates mock stub and forces redirection to `/api/auth/login`.
        """
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Legacy mock login is deprecated. Use root unified /api/auth/login endpoint."
        )
