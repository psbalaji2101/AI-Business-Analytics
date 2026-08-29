"""Sales upload, dedup, and aggregation tests."""
import pytest

CSV = (
    "asin,itemName,brandName,orderDay,orderMonth,orderYear,grossSales,grossUnits,"
    "netSales,netUnits,indexedGlanceViews,category,subcategory,stateName,city,postalCode\n"
    "B0TEST0001,CSV Name One,Kratos,1,4,2026,500,1,500,1,10,Electronics,Tripods,TAMIL NADU,CHENNAI,600001\n"
    "B0TEST0001,CSV Name One,Kratos,2,4,2026,1000,2,1000,2,10,Electronics,Tripods,KERALA,KOCHI,682001\n"
    "B0TEST0002,CSV Name Two,Kratos,3,4,2026,300,1,0,0,10,Electronics,Chargers,TAMIL NADU,MADURAI,625001\n"
)


async def _upload(client, headers, content: bytes, name="sales.csv"):
    files = {"file": (name, content, "text/csv")}
    return await client.post("/api/v1/sales/upload", files=files, headers=headers)


@pytest.mark.asyncio
async def test_upload_and_aggregations(client, auth_headers):
    # Seed an ASIN so the product name comes from the catalog, not the CSV.
    await client.post(
        "/api/v1/asins",
        json={"asin": "B0TEST0001", "product_name": "Catalog Name One"},
        headers=auth_headers,
    )

    resp = await _upload(client, auth_headers, CSV.encode())
    assert resp.status_code == 200
    body = resp.json()
    assert body["duplicate"] is False
    assert body["inserted"] == 3
    assert body["total_units"] == 4
    assert body["total_gross"] == 1800.0

    summary = (await client.get("/api/v1/sales/summary", headers=auth_headers)).json()
    assert summary["total_units"] == 4
    assert summary["total_orders"] == 3
    assert summary["distinct_asins"] == 2
    assert summary["distinct_states"] == 2

    by_asin = (await client.get("/api/v1/sales/by-asin", headers=auth_headers)).json()
    a1 = next(r for r in by_asin if r["asin"] == "B0TEST0001")
    # Product name is taken from the ASIN catalog, NOT overridden by the CSV.
    assert a1["product_name"] == "Catalog Name One"
    assert a1["units"] == 3
    assert a1["gross_sales"] == 1500.0
    # ASIN not in catalog falls back to the CSV item name.
    a2 = next(r for r in by_asin if r["asin"] == "B0TEST0002")
    assert a2["product_name"] == "CSV Name Two"

    by_state = (await client.get("/api/v1/sales/by-state", headers=auth_headers)).json()
    tn = next(r for r in by_state if r["state_name"] == "TAMIL NADU")
    assert tn["units"] == 2  # 1 + 1
    assert tn["orders"] == 2


@pytest.mark.asyncio
async def test_duplicate_upload_is_skipped(client, auth_headers):
    first = await _upload(client, auth_headers, CSV.encode())
    assert first.json()["inserted"] == 3

    dup = await _upload(client, auth_headers, CSV.encode())
    assert dup.status_code == 200
    assert dup.json()["duplicate"] is True
    assert dup.json()["inserted"] == 0

    # Totals must not double up.
    summary = (await client.get("/api/v1/sales/summary", headers=auth_headers)).json()
    assert summary["total_units"] == 4

    uploads = (await client.get("/api/v1/sales/uploads", headers=auth_headers)).json()
    assert len(uploads) == 1


@pytest.mark.asyncio
async def test_delete_upload_removes_rows(client, auth_headers):
    up = (await _upload(client, auth_headers, CSV.encode())).json()
    upload_id = up["upload_id"]

    resp = await client.delete(f"/api/v1/sales/uploads/{upload_id}", headers=auth_headers)
    assert resp.status_code == 204

    summary = (await client.get("/api/v1/sales/summary", headers=auth_headers)).json()
    assert summary["total_units"] == 0
    assert summary["total_orders"] == 0
