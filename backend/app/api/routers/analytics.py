"""Analytics router — trends, comparisons, rankings, anomaly detection."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.analytics import RankingResponse, TrendResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(
    prefix="/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)]
)


def _split(value: str | None) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()] if value else []


@router.get("/trends", response_model=TrendResponse)
async def trends(
    metric: str = Query("price"),
    interval: str = Query("30"),  # 7 | 30 | 90 | custom
    date_from: str | None = None,
    date_to: str | None = None,
    asin: str | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> TrendResponse:
    return await AnalyticsService(db).trends(
        metric=metric,
        interval=interval,
        date_from=date_from,
        date_to=date_to,
        asin=asin,
        category=category,
    )


@router.get("/compare", response_model=TrendResponse)
async def compare(
    metric: str = Query("price"),
    interval: str = Query("30"),
    asins: str | None = Query(None, description="comma-separated ASINs"),
    categories: str | None = Query(None, description="comma-separated categories"),
    db: AsyncSession = Depends(get_db),
) -> TrendResponse:
    return await AnalyticsService(db).compare(
        metric=metric,
        interval=interval,
        asins=_split(asins),
        categories=_split(categories),
    )


@router.get("/rankings", response_model=RankingResponse)
async def rankings(
    metric: str = Query("rating_count"),
    interval: str = Query("30"),
    order: str = Query("desc"),  # desc => winners, asc => losers
    db: AsyncSession = Depends(get_db),
) -> RankingResponse:
    return await AnalyticsService(db).rankings(metric=metric, interval=interval, order=order)


@router.get("/anomalies")
async def anomalies(db: AsyncSession = Depends(get_db)) -> dict:
    # Placeholder until anomaly detection + AI narration ship in Phase 6.
    return {"anomalies": []}
