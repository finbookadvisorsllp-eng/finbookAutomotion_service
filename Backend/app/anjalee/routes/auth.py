from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login():
    """
    Legacy authentication endpoint.
    Redirects with HTTP 307 (Temporary Redirect) to preserve request method and body
    to the new shared auth handler at `/api/auth/login`.
    """
    return RedirectResponse(url="/api/auth/login", status_code=307)
