"""User management router — create and track dashboard users."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.asin import UserCreate, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[UserOut]:
    return await UserService(db).list()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> UserOut:
    service = UserService(db)
    if await service.get_by_email(payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.")
    return await service.create(email=payload.email, password=payload.password)
