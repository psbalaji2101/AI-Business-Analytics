"""Seed script — inserts the 7 tracked ASINs + ~90 days of synthetic snapshots.

The synthetic history lets the dashboard & analytics work end-to-end before live
HTML scraping (Phase 5). Data is reproducible (RNG seeded per ASIN) with realistic
drift: accumulating reviews, slow price movement, sentiment shifts, occasional stock-outs.

Run:  python -m app.seed                # ASINs + synthetic snapshots (demo)
      python -m app.seed --asins-only   # ASINs only (then run a real scrape)
"""
import asyncio
import hashlib
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import Asin, Snapshot
from app.db.session import AsyncSessionLocal, init_db

SEED_ASINS = [
    ("B0DZHX9H4L", "Mobile Holder"),
    ("B0DZHW42T8", "Mobile Holder"),
    ("B0FH9L7Q86", "Mobile Holder"),
    ("B0DXCWSMBQ", "Mobile Holder"),
    ("B0FY3GW1Y6", "Mobile Holder"),
    ("B0DXCV76QP", "Mobile Holder"),
    ("B0FY3L1FNX", "Mobile Holder"),
]

HISTORY_DAYS = 90
SCRAPE_HOURS = (6, 14, 22)


def _build_snapshot(asin_id: int, scraped_at: datetime, price: float, total: int, pos_ratio: float):
    positive = round(total * pos_ratio)
    negative = total - positive
    s5 = round(positive * 0.78)
    s4 = positive - s5
    s3 = round(negative * 0.5)
    s2 = round(negative * 0.3)
    s1 = max(negative - s3 - s2, 0)
    weighted = s5 * 5 + s4 * 4 + s3 * 3 + s2 * 2 + s1 * 1
    avg = round(weighted / total, 2) if total else None
    in_stock = True  # set by caller via override
    return Snapshot(
        asin_id=asin_id,
        scraped_at=scraped_at,
        price=round(price, 2),
        currency="INR",
        total_rating_cnt=total,
        avg_rating=avg,
        star_5=s5,
        star_4=s4,
        star_3=s3,
        star_2=s2,
        star_1=s1,
        buy_box_available=in_stock,
        in_stock=in_stock,
        positive_rating=s5 + s4,
        negative_rating=s3 + s2 + s1,
        raw_payload={"source": "seed"},
    )


def _generate_history(asin: Asin) -> list[Snapshot]:
    seed = int(hashlib.md5(asin.asin.encode()).hexdigest(), 16) % (10**8)
    rng = random.Random(seed)

    base_price = rng.uniform(199, 899)
    price = base_price
    total = rng.randint(150, 1200)
    pos_ratio = rng.uniform(0.80, 0.92)

    now = datetime.now(timezone.utc)
    start_day = (now - timedelta(days=HISTORY_DAYS)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # Occasional multi-day stock-out window.
    out_start = rng.randint(20, HISTORY_DAYS - 5)
    out_len = rng.choice([0, 0, 0, 2, 3])  # mostly no stock-out

    snapshots: list[Snapshot] = []
    for d in range(HISTORY_DAYS + 1):
        # Daily drift.
        price = max(149.0, min(price + rng.uniform(-7, 5), base_price * 1.3))
        total += rng.randint(0, 14)
        pos_ratio = max(0.60, min(pos_ratio + rng.uniform(-0.012, 0.008), 0.95))
        in_stock = not (out_start <= d < out_start + out_len)

        for hour in SCRAPE_HOURS:
            scraped_at = start_day + timedelta(days=d, hours=hour)
            if scraped_at > now:
                continue
            snap = _build_snapshot(
                asin.id, scraped_at, price + rng.uniform(-3, 3), total, pos_ratio
            )
            snap.buy_box_available = in_stock
            snap.in_stock = in_stock
            snapshots.append(snap)

    if snapshots:
        asin.last_scraped_at = snapshots[-1].scraped_at
    return snapshots


async def seed() -> None:
    await init_db()
    asins_only = "--asins-only" in sys.argv
    async with AsyncSessionLocal() as db:
        created_asins = 0
        for asin_code, name in SEED_ASINS:
            existing = await db.scalar(select(Asin).where(Asin.asin == asin_code))
            if existing:
                continue
            asin = Asin(
                asin=asin_code,
                product_name=name,
                category="Accessories",
                sub_category="Mobile Holder",
            )
            db.add(asin)
            await db.flush()  # assign asin.id
            if not asins_only:
                for snap in _generate_history(asin):
                    db.add(snap)
            created_asins += 1

        await db.commit()
        if asins_only:
            print(f"Seed complete (ASINs only). Created {created_asins} ASIN(s), no snapshots.")
        else:
            print(
                f"Seed complete. Created {created_asins} ASIN(s) "
                f"with ~{HISTORY_DAYS} days of snapshots each."
            )


if __name__ == "__main__":
    asyncio.run(seed())
