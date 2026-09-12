"""Async SQLAlchemy engine and session factory."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables for dev (Alembic handles prod migrations)."""
    from app.db import models  # noqa: F401  ensure models are imported

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_columns)

    # Keep the configured development login usable while moving authentication
    # to persisted users. Existing installations are left unchanged.
    from app.core.config import settings
    from app.services.user_service import UserService

    async with AsyncSessionLocal() as session:
        await UserService(session).ensure_configured_user(
            email=settings.auth_email, password=settings.auth_password
        )


def _ensure_columns(sync_conn) -> None:
    """Lightweight additive migration: add new columns to an existing table."""
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    asin_columns = {c["name"] for c in inspector.get_columns("asins")}
    if "name_is_custom" not in asin_columns:
        default = "0" if sync_conn.dialect.name == "sqlite" else "false"
        sync_conn.execute(
            text(f"ALTER TABLE asins ADD COLUMN name_is_custom BOOLEAN NOT NULL DEFAULT {default}")
        )

    forecast_columns = {
        c["name"] for c in inspector.get_columns("operational_forecast_rows")
    }
    if "effective_from" not in forecast_columns:
        sync_conn.execute(
            text("ALTER TABLE operational_forecast_rows ADD COLUMN effective_from DATE")
        )
        sync_conn.execute(
            text(
                "UPDATE operational_forecast_rows "
                "SET effective_from = ("
                "SELECT forecast_month FROM operational_forecast_uploads "
                "WHERE operational_forecast_uploads.id = operational_forecast_rows.upload_id"
                ") WHERE effective_from IS NULL"
            )
        )
    if "source_amendment_id" not in forecast_columns:
        sync_conn.execute(
            text(
                "ALTER TABLE operational_forecast_rows "
                "ADD COLUMN source_amendment_id BIGINT"
            )
        )

    amendment_columns = {
        c["name"] for c in inspector.get_columns("operational_forecast_amendments")
    }
    if "deleted_at" not in amendment_columns:
        sync_conn.execute(
            text(
                "ALTER TABLE operational_forecast_amendments "
                "ADD COLUMN deleted_at TIMESTAMP"
            )
        )
