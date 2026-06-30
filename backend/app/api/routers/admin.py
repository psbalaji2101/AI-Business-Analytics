"""Admin router — manual scrape trigger (also runs 3x/day via the scheduler)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.services.snapshot_service import SnapshotService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_user)])


@router.post("/scrape/run")
async def run_scrape(db: AsyncSession = Depends(get_db)) -> dict:
    run = await SnapshotService(db).scrape_all_active()
    return {
        "status": run.status,
        "adapter": run.adapter,
        "total": run.total,
        "succeeded": run.succeeded,
        "failed": run.failed,
    }
