"""Snapshot persistence and retrieval helpers."""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Asin, ScrapeRun, Snapshot
from app.scrapers.base import ScrapeResult
from app.scrapers.factory import get_scraper


class SnapshotService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _to_snapshot(self, asin_id: int, result: ScrapeResult) -> Snapshot:
        return Snapshot(
            asin_id=asin_id,
            price=result.price,
            currency=result.currency,
            total_rating_cnt=result.total_rating_cnt,
            avg_rating=result.avg_rating,
            star_5=result.star_5,
            star_4=result.star_4,
            star_3=result.star_3,
            star_2=result.star_2,
            star_1=result.star_1,
            buy_box_available=result.buy_box_available,
            in_stock=result.in_stock,
            positive_rating=result.positive_rating,
            negative_rating=result.negative_rating,
            raw_payload=result.raw_payload,
        )

    async def save_result(self, asin: Asin, result: ScrapeResult) -> Snapshot:
        snap = self._to_snapshot(asin.id, result)
        self.db.add(snap)
        asin.last_scraped_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(snap)
        return snap

    async def scrape_and_save(self, asin: Asin) -> bool:
        """Scrape a single ASIN and persist a snapshot. Best-effort (never raises)."""
        scraper = get_scraper()
        try:
            result = await scraper.scrape(asin.asin)
        except Exception:  # noqa: BLE001 - adding the ASIN must not fail if scraping does
            return False
        self.db.add(self._to_snapshot(asin.id, result))
        if result.product_name and not asin.name_is_custom:
            asin.product_name = result.product_name
        asin.last_scraped_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def latest_per_asin(self) -> dict[int, Snapshot]:
        """Return the most recent snapshot for each ASIN, keyed by asin_id."""
        rows = (
            await self.db.scalars(
                select(Snapshot).order_by(Snapshot.asin_id, Snapshot.scraped_at.desc())
            )
        ).all()
        latest: dict[int, Snapshot] = {}
        for row in rows:
            if row.asin_id not in latest:
                latest[row.asin_id] = row
        return latest

    async def snapshot_near(self, asin_id: int, days_ago: int) -> Snapshot | None:
        """Closest snapshot at/after the point `days_ago` days back (for deltas)."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_ago)
        return await self.db.scalar(
            select(Snapshot)
            .where(Snapshot.asin_id == asin_id, Snapshot.scraped_at >= cutoff)
            .order_by(Snapshot.scraped_at.asc())
            .limit(1)
        )

    async def scrape_all_active(self) -> ScrapeRun:
        """Scrape every active ASIN with the configured adapter and persist snapshots.

        Used by the scheduler (Phase 5) and the manual trigger endpoint.
        """
        scraper = get_scraper()
        run = ScrapeRun(adapter=scraper.name, total=0, succeeded=0, failed=0, error_log={"errors": []})
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        asins = (
            await self.db.scalars(
                select(Asin).where(Asin.is_active.is_(True), Asin.is_deleted.is_(False))
            )
        ).all()

        succeeded, failed, errors = 0, 0, []
        for asin in asins:
            try:
                result = await scraper.scrape(asin.asin)
                self.db.add(self._to_snapshot(asin.id, result))
                if result.product_name and not asin.name_is_custom:
                    asin.product_name = result.product_name
                asin.last_scraped_at = datetime.now(timezone.utc)
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - record and continue
                failed += 1
                errors.append({"asin": asin.asin, "error": str(exc)})
            # Polite rate limiting between requests (skip for the mock adapter).
            if scraper.name != "mock" and settings.scraper_request_delay_seconds > 0:
                await asyncio.sleep(settings.scraper_request_delay_seconds)

        run.total = len(asins)
        run.succeeded = succeeded
        run.failed = failed
        run.error_log = {"errors": errors}
        run.status = "success" if failed == 0 else ("partial" if succeeded else "failed")
        run.finished_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(run)
        return run


async def scrape_all_active_bg() -> None:
    """Background-task entrypoint: scrape all active ASINs with a fresh DB session."""
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await SnapshotService(db).scrape_all_active()
