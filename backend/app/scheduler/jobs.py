"""APScheduler setup — runs the scrape job 3x/day (configurable hours)."""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def scrape_job() -> None:
    """Scrape all active ASINs and persist snapshots."""
    logger.info("Scheduled scrape job triggered (adapter=%s)", settings.scraper_adapter)
    from app.db.session import AsyncSessionLocal
    from app.services.snapshot_service import SnapshotService

    async with AsyncSessionLocal() as db:
        run = await SnapshotService(db).scrape_all_active()
        logger.info(
            "Scrape job done: status=%s succeeded=%s failed=%s",
            run.status,
            run.succeeded,
            run.failed,
        )


def start_scheduler() -> None:
    for hour in settings.scrape_hours_list:
        scheduler.add_job(
            scrape_job,
            CronTrigger(hour=hour, minute=0),
            id=f"scrape-{hour}",
            replace_existing=True,
        )
    scheduler.start()
    logger.info("Scheduler started for hours: %s", settings.scrape_hours_list)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
