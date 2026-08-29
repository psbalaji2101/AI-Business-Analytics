"""Dashboard & analytics tests (using the mock scraper to populate snapshots)."""
from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Snapshot
from app.db.session import AsyncSessionLocal

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


async def test_alerts_include_snapshot_changes_and_current_stock(client, auth_headers):
    created = await client.post(
        "/api/v1/asins",
        headers=auth_headers,
        json={"asin": "B0ALERT001", "product_name": "Alert Product", "category": "Accessories"},
    )
    asin_id = created.json()["id"]
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        db.add_all(
            [
                Snapshot(
                    asin_id=asin_id, scraped_at=now - timedelta(hours=8), price=500,
                    avg_rating=4.4, positive_rating=100, negative_rating=10, in_stock=True,
                ),
                Snapshot(
                    asin_id=asin_id, scraped_at=now, price=550,
                    avg_rating=4.2, positive_rating=103, negative_rating=13, in_stock=False,
                ),
            ]
        )
        await db.commit()

    response = await client.get("/api/v1/alerts", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    alert_types = {row["alert_type"] for row in body["rows"]}
    assert {
        "out_of_stock",
        "price_increased",
        "rating_decreased",
        "positive_reviews_increased",
        "negative_reviews_increased",
    } <= alert_types
    assert body["summary"]["out_of_stock"] == 1
    negative = next(row for row in body["rows"] if row["alert_type"] == "negative_reviews_increased")
    assert negative["change"] == 3

    history = await client.get("/api/v1/alerts?interval=7", headers=auth_headers)
    assert history.status_code == 200
    assert any(row["alert_type"] == "price_increased" for row in history.json()["rows"])

    custom = await client.get(
        "/api/v1/alerts",
        headers=auth_headers,
        params={
            "interval": "custom",
            "date_from": (now - timedelta(days=1)).date().isoformat(),
            "date_to": now.date().isoformat(),
        },
    )
    assert custom.status_code == 200
    assert any(row["alert_type"] == "rating_decreased" for row in custom.json()["rows"])
