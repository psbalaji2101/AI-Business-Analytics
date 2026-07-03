"""Auth flow tests."""
import pytest

pytestmark = pytest.mark.asyncio


async def test_login_success(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "balaji@aibusinessanalytics.com", "password": "Password1!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"]
    assert body["user"]["email"] == "balaji@aibusinessanalytics.com"


async def test_login_invalid(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "nope"},
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client):
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_me_with_token(client, auth_headers):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "balaji@aibusinessanalytics.com"


async def test_protected_route_blocks_anonymous(client):
    assert (await client.get("/api/v1/asins")).status_code == 401
