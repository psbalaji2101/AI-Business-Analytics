"""Dashboard & analytics tests (using the mock scraper to populate snapshots)."""
import pytest

pytestmark = pytest.mark.asyncio


async def _seed_products(client, headers):
    for asin in ("B0PROD0001", "B0PROD0002"):
        await client.post(
            "/api/v1/asins",
            headers=headers,
            json={"asin": asin, "product_name": f"Prod {asin}", "category": "Accessories",
                  "sub_category": "Mobile Holder"},
        )
    # Two scrapes -> two snapshots per ASIN (enables price_change / velocity calc).
    await client.post("/api/v1/admin/scrape/run", headers=headers)
    await client.post("/api/v1/admin/scrape/run", headers=headers)


async def test_scrape_run_reports_success(client, auth_headers):
    await client.post(
        "/api/v1/asins",
        headers=auth_headers,
        json={"asin": "B0SCRAPE01", "product_name": "X", "category": "Accessories"},
    )
    resp = await client.post("/api/v1/admin/scrape/run", headers=auth_headers)
    body = resp.json()
    assert body["status"] == "success"
    assert body["adapter"] == "mock"
    assert body["succeeded"] == 1


async def test_dashboard_summary(client, auth_headers):
    await _seed_products(client, auth_headers)
    resp = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_products"] == 2
    assert body["in_stock"] + body["out_of_stock"] == 2
    assert body["avg_rating"] is not None
    assert len(body["categories"]) == 1


async def test_dashboard_products_have_metrics(client, auth_headers):
    await _seed_products(client, auth_headers)
    resp = await client.get("/api/v1/dashboard/products", headers=auth_headers)
    cards = resp.json()
    assert len(cards) == 2
    card = cards[0]
    assert card["price"] is not None
    assert card["amazon_url"].endswith(card["asin"])
    assert card["positive_rating"] is not None


async def test_trends_returns_series(client, auth_headers):
    await _seed_products(client, auth_headers)
    resp = await client.get(
        "/api/v1/analytics/trends?metric=price&interval=30", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == "price"
    assert len(body["series"]) == 1


async def test_rankings_sorted(client, auth_headers):
    await _seed_products(client, auth_headers)
    resp = await client.get(
        "/api/v1/analytics/rankings?metric=rating_count&interval=30&order=desc",
        headers=auth_headers,
    )
    rows = resp.json()["rows"]
    assert len(rows) == 2
    values = [r["value"] for r in rows if r["value"] is not None]
    assert values == sorted(values, reverse=True)
