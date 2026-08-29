"""Persistence and authentication for dashboard users."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.db.models import User


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self) -> list[User]:
        return list((await self.db.scalars(select(User).order_by(User.created_at.desc()))).all())

    async def get_by_email(self, email: str) -> User | None:
        return await self.db.scalar(select(User).where(User.email == email.strip().lower()))

    async def create(self, *, email: str, password: str) -> User:
        user = User(email=email.strip().lower(), password_hash=hash_password(password))
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def authenticate(self, *, email: str, password: str) -> User | None:
        user = await self.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            return None
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def ensure_configured_user(self, *, email: str, password: str) -> None:
        """Seed the configured local admin once when the application starts."""
        if await self.get_by_email(email):
            return
        await self.create(email=email, password=password)
