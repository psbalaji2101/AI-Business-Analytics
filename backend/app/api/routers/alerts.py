"""Operational alerts router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.alerts import AlertsResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=AlertsResponse)
async def list_alerts(
    interval: str = Query("latest"),  # latest | 24h | 7 | 30 | 90 | custom
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> AlertsResponse:
    return await AlertService(db).list_alerts(
        interval=interval, date_from=date_from, date_to=date_to
    )
