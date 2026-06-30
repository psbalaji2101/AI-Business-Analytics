"""Shared API dependencies."""
from fastapi import Depends, Header, HTTPException, status

from app.core.security import decode_access_token


async def get_current_user(authorization: str | None = Header(default=None)) -> str:
    """Validate the Bearer token and return the user's email."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    subject = decode_access_token(token)
    if subject is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return subject


CurrentUser = Depends(get_current_user)
