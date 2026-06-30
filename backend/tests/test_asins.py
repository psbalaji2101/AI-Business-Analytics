"""ASIN CRUD, search, pagination, tracking, bulk upload tests."""
import pytest

pytestmark = pytest.mark.asyncio


async def _create(client, headers, asin="B0TEST00001", name="Test Holder"):
    return await client.post(
        "/api/v1/asins",
        headers=headers,
        json={"asin": asin, "product_name": name, "category": "Accessories",
              "sub_category": "Mobile Holder"},
    )


async def test_create_and_get(client, auth_headers):
    resp = await _create(client, auth_headers)
    assert resp.status_code == 201
    asin_id = resp.json()["id"]

    got = await client.get(f"/api/v1/asins/{asin_id}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["asin"] == "B0TEST00001"


async def test_duplicate_returns_409(client, auth_headers):
    await _create(client, auth_headers)
    dup = await _create(client, auth_headers)
    assert dup.status_code == 409
    assert "already exists" in dup.json()["detail"]


async def test_list_search_and_filter(client, auth_headers):
    await _create(client, auth_headers, "B0AAAA0001", "Alpha Holder")
    await _create(client, auth_headers, "B0BBBB0002", "Beta Mount")

    all_items = await client.get("/api/v1/asins", headers=auth_headers)
    assert all_items.json()["total"] == 2

    search = await client.get("/api/v1/asins?q=Alpha", headers=auth_headers)
    assert search.json()["total"] == 1
    assert search.json()["items"][0]["asin"] == "B0AAAA0001"


async def test_pagination(client, auth_headers):
    for i in range(5):
        await _create(client, auth_headers, f"B0PAGE000{i}", f"Item {i}")
    page = await client.get("/api/v1/asins?page=1&page_size=2", headers=auth_headers)
    body = page.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2


async def test_update_and_tracking(client, auth_headers):
    created = (await _create(client, auth_headers)).json()
    asin_id = created["id"]

    upd = await client.put(
        f"/api/v1/asins/{asin_id}", headers=auth_headers, json={"product_name": "Renamed"}
    )
    assert upd.status_code == 200
    assert upd.json()["product_name"] == "Renamed"

    track = await client.patch(
        f"/api/v1/asins/{asin_id}/tracking", headers=auth_headers, json={"is_active": False}
    )
    assert track.status_code == 200
    assert track.json()["is_active"] is False


async def test_custom_name_survives_scrape(client, auth_headers):
    # A user-typed name (create or edit) is marked custom and must survive scrapes.
    asin_id = (await _create(client, auth_headers)).json()["id"]

    renamed = await client.put(
        f"/api/v1/asins/{asin_id}", headers=auth_headers, json={"product_name": "My Custom Name"}
    )
    assert renamed.json()["product_name"] == "My Custom Name"
    assert renamed.json()["name_is_custom"] is True

    # A subsequent scrape must NOT overwrite the user's custom name.
    await client.post("/api/v1/admin/scrape/run", headers=auth_headers)
    after = await client.get(f"/api/v1/asins/{asin_id}", headers=auth_headers)
    assert after.json()["product_name"] == "My Custom Name"


async def test_delete_removes_asin(client, auth_headers):
    asin_id = (await _create(client, auth_headers)).json()["id"]
    deleted = await client.delete(f"/api/v1/asins/{asin_id}", headers=auth_headers)
    assert deleted.status_code == 204

    listing = await client.get("/api/v1/asins", headers=auth_headers)
    assert listing.json()["total"] == 0
    assert (await client.get(f"/api/v1/asins/{asin_id}", headers=auth_headers)).status_code == 404


async def test_can_readd_after_delete(client, auth_headers):
    first = await _create(client, auth_headers)
    assert first.status_code == 201
    await client.delete(f"/api/v1/asins/{first.json()['id']}", headers=auth_headers)
    # Re-adding the same ASIN must succeed now that delete is permanent.
    again = await _create(client, auth_headers)
    assert again.status_code == 201
    assert (await client.get("/api/v1/asins", headers=auth_headers)).json()["total"] == 1


async def test_bulk_upload_csv(client, auth_headers):
    csv = b"asin,product_name,category,sub_category\nB0CSV00001,CSV Holder,Accessories,Mobile Holder\n"
    resp = await client.post(
        "/api/v1/asins/bulk-upload",
        headers=auth_headers,
        files={"file": ("asins.csv", csv, "text/csv")},
    )
    assert resp.status_code == 200
    assert resp.json()["created"] == 1
    assert (await client.get("/api/v1/asins", headers=auth_headers)).json()["total"] == 1
