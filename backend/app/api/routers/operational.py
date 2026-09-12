"""Operational Analytics API: uploads, downloads, management, and dashboard."""
# ruff: noqa: B008 - FastAPI dependencies are intentionally declared as defaults.
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.operational import (
    ActualUploadOut,
    ForecastAmendmentOut,
    ForecastUploadOut,
    OperationalActualUploadResult,
    OperationalDashboard,
    OperationalUploadResult,
)
from app.services.operational_service import OperationalError, OperationalService

router = APIRouter(
    prefix="/operational", tags=["operational"], dependencies=[Depends(get_current_user)]
)


def _raise(error: OperationalError) -> None:
    raise HTTPException(error.status_code, error.message) from error


def _month(value: str) -> date:
    try:
        year, month = (int(part) for part in value.split("-"))
        return date(year, month, 1)
    except (TypeError, ValueError) as error:
        raise HTTPException(422, "Target month must use YYYY-MM format.") from error


def _file_response(content: bytes, filename: str, content_type: str) -> Response:
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.post("/forecasts", response_model=OperationalUploadResult, status_code=201)
async def upload_forecast(
    forecast_month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> OperationalUploadResult:
    try:
        return await OperationalService(db).upload_forecast(
            _month(forecast_month), file.filename or "Monthly Target.csv", await file.read()
        )
    except OperationalError as error:
        _raise(error)


@router.post(
    "/forecasts/{upload_id}/amendments",
    response_model=OperationalUploadResult,
    status_code=201,
)
async def add_forecast_asins(
    upload_id: int,
    effective_from: date,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> OperationalUploadResult:
    try:
        return await OperationalService(db).add_forecast_asins(
            upload_id,
            effective_from,
            file.filename or "target-amendment.csv",
            await file.read(),
        )
    except OperationalError as error:
        _raise(error)


@router.post("/actuals", response_model=OperationalActualUploadResult, status_code=201)
async def upload_actual(
    report_date: date,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> OperationalActualUploadResult:
    try:
        return await OperationalService(db).upload_actual(
            report_date, file.filename or "actuals.csv", await file.read()
        )
    except OperationalError as error:
        _raise(error)


@router.get("/forecasts", response_model=list[ForecastUploadOut])
async def list_forecasts(db: AsyncSession = Depends(get_db)) -> list[ForecastUploadOut]:
    return await OperationalService(db).list_forecasts()


@router.get("/forecast-amendments", response_model=list[ForecastAmendmentOut])
async def list_forecast_amendments(
    db: AsyncSession = Depends(get_db),
) -> list[ForecastAmendmentOut]:
    return await OperationalService(db).list_forecast_amendments()


@router.get("/actuals", response_model=list[ActualUploadOut])
async def list_actuals(db: AsyncSession = Depends(get_db)) -> list[ActualUploadOut]:
    return await OperationalService(db).list_actuals()


@router.delete("/forecasts/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_forecast(upload_id: int, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await OperationalService(db).delete_forecast(upload_id)
    except OperationalError as error:
        _raise(error)


@router.delete("/actuals/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_actual(upload_id: int, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await OperationalService(db).delete_actual(upload_id)
    except OperationalError as error:
        _raise(error)


@router.delete(
    "/forecast-amendments/{amendment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_forecast_amendment(
    amendment_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    try:
        await OperationalService(db).delete_forecast_amendment(amendment_id)
    except OperationalError as error:
        _raise(error)


@router.get("/forecasts/{upload_id}/download")
async def download_forecast(upload_id: int, db: AsyncSession = Depends(get_db)) -> Response:
    try:
        upload = await OperationalService(db).original_forecast(upload_id)
        return _file_response(upload.original_content, upload.filename, upload.content_type)
    except OperationalError as error:
        _raise(error)


@router.get("/forecast-amendments/{amendment_id}/download")
async def download_forecast_amendment(
    amendment_id: int, db: AsyncSession = Depends(get_db)
) -> Response:
    try:
        amendment = await OperationalService(db).original_forecast_amendment(amendment_id)
        return _file_response(
            amendment.original_content, amendment.filename, amendment.content_type
        )
    except OperationalError as error:
        _raise(error)


@router.get("/actuals/{upload_id}/download")
async def download_actual(upload_id: int, db: AsyncSession = Depends(get_db)) -> Response:
    try:
        upload = await OperationalService(db).original_actual(upload_id)
        return _file_response(upload.original_content, upload.filename, upload.content_type)
    except OperationalError as error:
        _raise(error)


@router.get("/templates/{kind}")
async def download_template(kind: str, file_format: str = "xlsx") -> Response:
    if kind not in {"forecast", "actual"}:
        raise HTTPException(404, "Template not found.")
    try:
        content, filename, content_type = OperationalService.template(kind, file_format)
        return _file_response(content, filename, content_type)
    except OperationalError as error:
        _raise(error)


@router.get("/dashboard", response_model=OperationalDashboard)
async def dashboard(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> OperationalDashboard:
    try:
        return await OperationalService(db).dashboard(date_from=date_from, date_to=date_to)
    except OperationalError as error:
        _raise(error)


@router.get("/dashboard/export")
async def export_dashboard(
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    try:
        content, filename = await OperationalService(db).dashboard_export(
            date_from=date_from, date_to=date_to
        )
        return _file_response(content, filename, "text/csv; charset=utf-8")
    except OperationalError as error:
        _raise(error)
