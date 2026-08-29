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


async def test_create_and_track_user(client, auth_headers):
    created = await client.post(
        "/api/v1/users",
        headers=auth_headers,
        json={"email": "new.user@example.com", "password": "NewPassword1!"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["email"] == "new.user@example.com"
    assert body["created_at"]
    assert body["last_login_at"] is None

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "new.user@example.com", "password": "NewPassword1!"},
    )
    assert login.status_code == 200

    users = await client.get("/api/v1/users", headers=auth_headers)
    tracked = next(user for user in users.json() if user["email"] == "new.user@example.com")
    assert tracked["last_login_at"] is not None
