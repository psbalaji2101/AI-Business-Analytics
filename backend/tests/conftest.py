"""Pytest fixtures: isolated test DB + authenticated ASGI client (no live server)."""
import os

# Must be set BEFORE importing app modules so the engine binds to the test DB.
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_app.db"
os.environ["SCRAPER_ADAPTER"] = "mock"
os.environ["LLM_PROVIDER"] = "mock"

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402

from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

AUTH = {"email": "balaji@aibusinessanalytics.com", "password": "Password1!"}


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def auth_headers(client):
    resp = await client.post("/api/v1/auth/login", json=AUTH)
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}
