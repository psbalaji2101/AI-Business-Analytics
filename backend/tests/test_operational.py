"""Operational Analytics upload rules, downloads, and unit-economics tests."""
import io

import pytest
from openpyxl import load_workbook

FORECAST_CSV = (
    "ASIN,Short Name,Category,Daily Run Rate,PO Price,PO Value,CCOGS Budget,"
    "Ads Budget,Coupons Budget,Reviews Budget,Total Budget\n"
    "B0OPER0001,Main Cable,Cables,10,100,30000,0,3000,0,0,3000\n"
    "B0OPER0002,Travel Cable,Cables,5,200,30000,750,500,150,100,1500\n"
)

ACTUAL_CSV = (
    "ASIN,DRR (Actual),PO Price,CCOGS Spend,Ads Spend,Coupons Spend,Reviews Spend\n"
    "B0OPER0001,11,100,0,105,0,0\n"
)
FORECAST_BYTES = FORECAST_CSV.encode()
ACTUAL_BYTES = ACTUAL_CSV.encode()


async def upload_forecast(client, headers, content=FORECAST_BYTES, name="forecast.csv"):
    return await client.post(
        "/api/v1/operational/forecasts",
        params={"forecast_month": "2026-04"},
        files={"file": (name, content, "text/csv")},
        headers=headers,
    )


async def upload_actual(client, headers, content=ACTUAL_BYTES, name="actual.csv"):
    return await client.post(
        "/api/v1/operational/actuals",
        params={"report_date": "2026-04-01"},
        files={"file": (name, content, "text/csv")},
        headers=headers,
    )


@pytest.mark.asyncio
async def test_forecast_actual_dashboard_and_unit_economics(client, auth_headers):
    forecast = await upload_forecast(client, auth_headers)
    assert forecast.status_code == 201, forecast.text
    assert forecast.json()["row_count"] == 2
    assert forecast.json()["units"] == 450  # (10 + 5) × 30 April days

    actual = await upload_actual(client, auth_headers)
    assert actual.status_code == 201, actual.text
    assert actual.json()["row_count"] == 1
    assert actual.json()["units"] == 11

    response = await client.get(
        "/api/v1/operational/dashboard",
        params={"date_from": "2026-04-01", "date_to": "2026-04-01"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    dashboard = response.json()
    summary = dashboard["summary"]
    assert dashboard["covered_days"] == 1
    assert summary["planned_units"] == 15
    assert summary["actual_units"] == 11  # omitted B0OPER0002 contributes zero
    assert summary["planned_spend"] == 150
    assert summary["actual_spend"] == 105

    asin = dashboard["categories"][0]["asins"][0]
    assert asin["asin"] == "B0OPER0001"
    assert asin["planned_units"] == 10
    assert asin["actual_units"] == 11
    assert asin["planned_spend"] == 100
    assert asin["volume_adjusted_budget"] == 110
    assert asin["adjusted_spend_variance"] == -5
    assert asin["status"] == "healthy"  # ₹105 is productive, not overspend
    assert asin["timeline"][0]["expected_units"] == 10
    assert asin["timeline"][0]["actual_units"] == 11
    assert dashboard["categories"][0]["timeline"][0]["expected_units"] == 15

    timeline = dashboard["timeline"][0]
    assert timeline["cumulative_expected_units"] == 15
    assert timeline["cumulative_actual_units"] == 11


@pytest.mark.asyncio
async def test_spend_above_adjusted_budget_and_tolerance_is_flagged(client, auth_headers):
    await upload_forecast(client, auth_headers)
    overspend = ACTUAL_CSV.replace(",105,", ",116,").encode()
    response = await upload_actual(client, auth_headers, overspend)
    assert response.status_code == 201

    dashboard = (
        await client.get(
            "/api/v1/operational/dashboard",
            params={"date_from": "2026-04-01", "date_to": "2026-04-01"},
            headers=auth_headers,
        )
    ).json()
    asin = dashboard["categories"][0]["asins"][0]
    assert asin["volume_adjusted_budget"] == 110
    assert asin["actual_spend"] == 116
    assert asin["status"] == "overspend"  # ₹116 is > ₹110 + the confirmed 5% tolerance


@pytest.mark.asyncio
async def test_one_file_per_period_and_forecast_foreign_key(client, auth_headers):
    no_forecast = await upload_actual(client, auth_headers)
    assert no_forecast.status_code == 409
    assert "forecast before daily actuals" in no_forecast.json()["detail"]

    await upload_forecast(client, auth_headers)
    duplicate_forecast = await upload_forecast(client, auth_headers)
    assert duplicate_forecast.status_code == 409

    await upload_actual(client, auth_headers)
    duplicate_actual = await upload_actual(client, auth_headers)
    assert duplicate_actual.status_code == 409
    assert "Delete it before uploading" in duplicate_actual.json()["detail"]


@pytest.mark.asyncio
async def test_unknown_actual_asin_and_budget_validation(client, auth_headers):
    bad_budget = FORECAST_CSV.replace(",1500\n", ",1499\n").encode()
    response = await upload_forecast(client, auth_headers, bad_budget)
    assert response.status_code == 422
    assert "Total Budget must equal" in response.json()["detail"]

    await upload_forecast(client, auth_headers)
    unknown = ACTUAL_CSV.replace("B0OPER0001", "B0UNKNOWN1").encode()
    response = await upload_actual(client, auth_headers, unknown)
    assert response.status_code == 422
    assert "is not in the April 2026 forecast" in response.json()["detail"]


@pytest.mark.asyncio
async def test_management_original_download_export_and_delete_order(client, auth_headers):
    forecast_id = (await upload_forecast(client, auth_headers)).json()["upload_id"]
    actual_id = (await upload_actual(client, auth_headers)).json()["upload_id"]

    forecasts = (await client.get("/api/v1/operational/forecasts", headers=auth_headers)).json()
    actuals = (await client.get("/api/v1/operational/actuals", headers=auth_headers)).json()
    assert len(forecasts) == 1
    assert len(actuals) == 1

    original = await client.get(
        f"/api/v1/operational/forecasts/{forecast_id}/download", headers=auth_headers
    )
    assert original.status_code == 200
    assert original.content == FORECAST_CSV.encode()

    export = await client.get(
        "/api/v1/operational/dashboard/export",
        params={"date_from": "2026-04-01", "date_to": "2026-04-01"},
        headers=auth_headers,
    )
    assert export.status_code == 200
    assert b"Grand Total" in export.content
    assert b"B0OPER0001" in export.content

    blocked = await client.delete(
        f"/api/v1/operational/forecasts/{forecast_id}", headers=auth_headers
    )
    assert blocked.status_code == 409
    assert "daily actual files" in blocked.json()["detail"]

    assert (
        await client.delete(f"/api/v1/operational/actuals/{actual_id}", headers=auth_headers)
    ).status_code == 204
    assert (
        await client.delete(f"/api/v1/operational/forecasts/{forecast_id}", headers=auth_headers)
    ).status_code == 204


@pytest.mark.asyncio
async def test_xlsx_templates_and_upload(client, auth_headers):
    template = await client.get(
        "/api/v1/operational/templates/forecast",
        params={"file_format": "xlsx"},
        headers=auth_headers,
    )
    assert template.status_code == 200
    workbook = load_workbook(io.BytesIO(template.content))
    sheet = workbook.active
    assert sheet["A1"].value == "ASIN"
    sheet.append(["B0XLSX001", "XLSX Cable", "Cables", 11, 100, 30800, 1000, 1000, 500, 500, 3000])
    output = io.BytesIO()
    workbook.save(output)

    response = await upload_forecast(
        client,
        auth_headers,
        output.getvalue(),
        "forecast.xlsx",
    )
    assert response.status_code == 201, response.text
    assert response.json()["row_count"] == 1
    assert response.json()["units"] == 330  # April: uploaded rounded DRR 11 × 30


@pytest.mark.asyncio
async def test_operational_routes_require_auth(client):
    response = await client.get("/api/v1/operational/dashboard")
    assert response.status_code == 401
