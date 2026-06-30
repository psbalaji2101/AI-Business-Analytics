"""Auth router — mock single-user login with JWT session token."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_credentials
from app.schemas.asin import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    if not verify_credentials(payload.email, payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token = create_access_token(payload.email)
    return TokenResponse(token=token, user=UserOut(email=payload.email))


@router.get("/me", response_model=UserOut)
async def me(user: str = Depends(get_current_user)) -> UserOut:
    return UserOut(email=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    # Stateless JWT: client discards the token. Endpoint exists for symmetry.
    return None
