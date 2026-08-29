"""Sales router — upload sales reports and query aggregations for the Sales page."""
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.sales import (
    SalesByAsin,
    SalesByState,
    SalesSummary,
    SalesUploadOut,
    SalesUploadResult,
)
from app.services.sales_service import SalesService

router = APIRouter(prefix="/sales", tags=["sales"], dependencies=[Depends(get_current_user)])


@router.post("/upload", response_model=SalesUploadResult)
async def upload_sales(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
) -> SalesUploadResult:
    content = await file.read()
    return await SalesService(db).upload(file.filename or "sales.csv", content)


@router.get("/summary", response_model=SalesSummary)
async def summary(
    asin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> SalesSummary:
    return await SalesService(db).summary(asin=asin, date_from=date_from, date_to=date_to)


@router.get("/by-asin", response_model=list[SalesByAsin])
async def by_asin(
    asin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[SalesByAsin]:
    return await SalesService(db).by_asin(asin=asin, date_from=date_from, date_to=date_to)


@router.get("/by-state", response_model=list[SalesByState])
async def by_state(
    asin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[SalesByState]:
    return await SalesService(db).by_state(asin=asin, date_from=date_from, date_to=date_to)


@router.get("/uploads", response_model=list[SalesUploadOut])
async def list_uploads(db: AsyncSession = Depends(get_db)) -> list[SalesUploadOut]:
    return await SalesService(db).list_uploads()


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(upload_id: int, db: AsyncSession = Depends(get_db)) -> None:
    ok = await SalesService(db).delete_upload(upload_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
