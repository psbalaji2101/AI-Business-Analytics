"""Dashboard router — latest metrics, KPIs, product grid, AI insight widget."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.analytics import DashboardSummary, InsightOut, ProductCard
from app.services.analytics_service import AnalyticsService

router = APIRouter(
    prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)]
)


@router.get("/summary", response_model=DashboardSummary)
async def summary(db: AsyncSession = Depends(get_db)) -> DashboardSummary:
    return await AnalyticsService(db).dashboard_summary()


@router.get("/products", response_model=list[ProductCard])
async def products(db: AsyncSession = Depends(get_db)) -> list[ProductCard]:
    return await AnalyticsService(db).product_cards()


@router.get("/insights", response_model=InsightOut)
async def insights(db: AsyncSession = Depends(get_db)) -> InsightOut:
    # Placeholder until the AI insight engine ships in Phase 6.
    return InsightOut(
        headline="AI insights arrive in Phase 6.",
        details=[],
        generated_at=datetime.now(timezone.utc),
    )
