"""Auth router — mock single-user login with JWT session token."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_credentials
from app.db.session import get_db
from app.schemas.asin import LoginRequest, TokenResponse, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await UserService(db).authenticate(email=payload.email, password=payload.password)
    # The fallback keeps tests and a fresh local DB usable before lifespan startup
    # seeds the configured development account.
    if not user and not verify_credentials(payload.email, payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token = create_access_token(payload.email)
    return TokenResponse(token=token, user=UserOut.model_validate(user) if user else UserOut(email=payload.email))


@router.get("/me", response_model=UserOut)
async def me(user: str = Depends(get_current_user)) -> UserOut:
    return UserOut(email=user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    # Stateless JWT: client discards the token. Endpoint exists for symmetry.
    return None
