"""Run a one-off scrape of all active ASINs from the CLI.

Honors the SCRAPER_ADAPTER env var (html | mock). Example:
    SCRAPER_ADAPTER=html python -m app.scrape_now

On Windows PowerShell:
    $env:SCRAPER_ADAPTER="html"; python -m app.scrape_now
"""
import asyncio

from app.db.session import AsyncSessionLocal, init_db
from app.services.snapshot_service import SnapshotService


async def main() -> None:
    await init_db()
    async with AsyncSessionLocal() as db:
        run = await SnapshotService(db).scrape_all_active()
        print(
            f"Scrape finished: adapter={run.adapter} status={run.status} "
            f"total={run.total} succeeded={run.succeeded} failed={run.failed}"
        )
        if run.error_log and run.error_log.get("errors"):
            for err in run.error_log["errors"]:
                print(f"  ! {err['asin']}: {err['error']}")


if __name__ == "__main__":
    asyncio.run(main())
