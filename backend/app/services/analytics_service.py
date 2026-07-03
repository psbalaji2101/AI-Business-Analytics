"""Analytics aggregation: dashboard summary, product cards, trends, compare, rankings.

All numbers are computed deterministically in SQL/Python. (AI narration is Phase 6.)
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Asin, Snapshot
from app.schemas.analytics import (
    CategoryBreakdown,
    DashboardSummary,
    ProductCard,
    RankingResponse,
    RankingRow,
    TrendPoint,
    TrendResponse,
    TrendSeries,
)
from app.services.snapshot_service import SnapshotService

# metric key -> Snapshot attribute resolver
_METRICS = {
    "price": lambda s: _f(s.price),
    "avg_rating": lambda s: _f(s.avg_rating),
    "rating_count": lambda s: _f(s.total_rating_cnt),
    "positive": lambda s: _f(s.positive_rating),
    "negative": lambda s: _f(s.negative_rating),
    "stock": lambda s: (1.0 if s.in_stock else 0.0) if s.in_stock is not None else None,
}


def _f(value) -> float | None:
    return float(value) if value is not None else None


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.snapshots = SnapshotService(db)

    # ---------------- Dashboard ----------------
    async def dashboard_summary(self) -> DashboardSummary:
        asins = await self._active_asins()
        latest = await self.snapshots.latest_per_asin()

        in_stock = out_of_stock = 0
        prices, ratings, reviews = [], [], 0
        by_cat: dict[str, list[Snapshot]] = defaultdict(list)

        for a in asins:
            snap = latest.get(a.id)
            cat = a.category or "Uncategorized"
            if snap:
                by_cat[cat].append(snap)
                if snap.in_stock:
                    in_stock += 1
                else:
                    out_of_stock += 1
                if snap.price is not None:
                    prices.append(float(snap.price))
                if snap.avg_rating is not None:
                    ratings.append(float(snap.avg_rating))
                reviews += snap.total_rating_cnt or 0

        categories = [
            CategoryBreakdown(
                category=cat,
                product_count=len(snaps),
                avg_rating=round(
                    sum(float(s.avg_rating) for s in snaps if s.avg_rating is not None)
                    / max(sum(1 for s in snaps if s.avg_rating is not None), 1),
                    2,
                )
                if snaps
                else None,
                total_reviews=sum(s.total_rating_cnt or 0 for s in snaps),
            )
            for cat, snaps in sorted(by_cat.items())
        ]

        return DashboardSummary(
            total_products=len(asins),
            active_products=sum(1 for a in asins if a.is_active),
            in_stock=in_stock,
            out_of_stock=out_of_stock,
            avg_price=round(sum(prices) / len(prices), 2) if prices else None,
            avg_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
            total_reviews=reviews,
            categories=categories,
        )

    async def product_cards(self) -> list[ProductCard]:
        # Show every active product, even if it has not been scraped yet (null metrics),
        # so the grid count matches the "active products" KPI and the analytics dropdown.
        asins = [a for a in await self._active_asins() if a.is_active]
        latest = await self.snapshots.latest_per_asin()
        cards: list[ProductCard] = []

        for a in asins:
            base = dict(
                asin=a.asin,
                product_name=a.product_name,
                category=a.category,
                sub_category=a.sub_category,
                amazon_url=f"{settings.amazon_base_url}{a.asin}",
            )
            snap = latest.get(a.id)
            if not snap:
                cards.append(ProductCard(**base))  # tracked, awaiting first scrape
                continue

            prev = await self._previous_snapshot(a.id, snap.id)
            week_ago = await self.snapshots.snapshot_near(a.id, 7)

            price_change = None
            if snap.price is not None and prev and prev.price is not None:
                price_change = round(float(snap.price) - float(prev.price), 2)

            review_velocity = rating_growth = None
            if week_ago:
                if snap.total_rating_cnt is not None and week_ago.total_rating_cnt is not None:
                    review_velocity = round(
                        (snap.total_rating_cnt - week_ago.total_rating_cnt) / 7, 2
                    )
                if snap.avg_rating is not None and week_ago.avg_rating is not None:
                    rating_growth = round(float(snap.avg_rating) - float(week_ago.avg_rating), 2)

            cards.append(
                ProductCard(
                    **base,
                    price=_f(snap.price),
                    avg_rating=_f(snap.avg_rating),
                    total_rating_cnt=snap.total_rating_cnt,
                    positive_rating=snap.positive_rating,
                    negative_rating=snap.negative_rating,
                    in_stock=snap.in_stock,
                    price_change=price_change,
                    review_velocity=review_velocity,
                    rating_growth=rating_growth,
                    last_scraped_at=snap.scraped_at,
                )
            )
        return cards

    # ---------------- Analytics ----------------
    async def trends(
        self,
        *,
        metric: str,
        interval: str,
        date_from: str | None,
        date_to: str | None,
        asin: str | None,
        category: str | None,
    ) -> TrendResponse:
        start, end = self._window(interval, date_from, date_to)
        rows = await self._snapshots_in_window(start, end, asin=asin, category=category)
        resolver = _METRICS.get(metric, _METRICS["price"])

        # Per ASIN: keep the last snapshot value per calendar day.
        per_asin_day: dict[str, dict[str, float]] = defaultdict(dict)
        for a, snap in rows:
            value = resolver(snap)
            if value is None:
                continue
            day = snap.scraped_at.date().isoformat()
            per_asin_day[a.asin][day] = value  # later snapshot overwrites earlier same-day

        if asin:
            # Single product series.
            label = next((a.product_name for a, _ in rows), asin)
            points = [
                TrendPoint(date=d, value=v)
                for d, v in sorted(per_asin_day.get(asin, {}).items())
            ]
            series = [TrendSeries(label=label, asin=asin, points=points)]
        else:
            # Aggregate (average across products) per day.
            day_values: dict[str, list[float]] = defaultdict(list)
            for days in per_asin_day.values():
                for d, v in days.items():
                    day_values[d].append(v)
            label = f"Category: {category}" if category else "All products"
            points = [
                TrendPoint(date=d, value=round(sum(vs) / len(vs), 2))
                for d, vs in sorted(day_values.items())
            ]
            series = [TrendSeries(label=label, points=points)]

        return TrendResponse(metric=metric, interval=interval, series=series)

    async def compare(
        self,
        *,
        metric: str,
        interval: str,
        asins: list[str] | None,
        categories: list[str] | None,
    ) -> TrendResponse:
        start, end = self._window(interval, None, None)
        series: list[TrendSeries] = []

        for code in asins or []:
            rows = await self._snapshots_in_window(start, end, asin=code)
            series.append(self._series_for_rows(rows, metric, label=code, asin=code))

        for cat in categories or []:
            rows = await self._snapshots_in_window(start, end, category=cat)
            series.append(self._series_for_rows(rows, metric, label=f"Category: {cat}"))

        return TrendResponse(metric=metric, interval=interval, series=series)

    async def rankings(
        self, *, metric: str, interval: str, order: str = "desc"
    ) -> RankingResponse:
        start, end = self._window(interval, None, None)
        asins = await self._active_asins()
        latest = await self.snapshots.latest_per_asin()
        resolver = _METRICS.get(metric, _METRICS["price"])

        rows: list[RankingRow] = []
        for a in asins:
            snap = latest.get(a.id)
            if not snap:
                continue
            value = resolver(snap)
            baseline = await self.snapshots.snapshot_near(
                a.id, (end - start).days if (end - start).days > 0 else 7
            )
            change = None
            if value is not None and baseline:
                base_val = resolver(baseline)
                if base_val is not None:
                    change = round(value - base_val, 2)
            rows.append(
                RankingRow(
                    asin=a.asin,
                    product_name=a.product_name,
                    value=value,
                    change=change,
                    in_stock=snap.in_stock,
                )
            )

        rows.sort(key=lambda r: (r.value is None, r.value or 0), reverse=(order == "desc"))
        return RankingResponse(metric=metric, rows=rows)

    # ---------------- helpers ----------------
    async def _active_asins(self) -> list[Asin]:
        return list(
            (
                await self.db.scalars(
                    select(Asin).where(Asin.is_deleted.is_(False)).order_by(Asin.product_name)
                )
            ).all()
        )

    async def _previous_snapshot(self, asin_id: int, before_id: int) -> Snapshot | None:
        return await self.db.scalar(
            select(Snapshot)
            .where(Snapshot.asin_id == asin_id, Snapshot.id < before_id)
            .order_by(Snapshot.id.desc())
            .limit(1)
        )

    async def _snapshots_in_window(
        self,
        start: datetime,
        end: datetime,
        *,
        asin: str | None = None,
        category: str | None = None,
    ) -> list[tuple[Asin, Snapshot]]:
        stmt = (
            select(Asin, Snapshot)
            .join(Snapshot, Snapshot.asin_id == Asin.id)
            .where(
                Asin.is_deleted.is_(False),
                Snapshot.scraped_at >= start,
                Snapshot.scraped_at <= end,
            )
            .order_by(Snapshot.scraped_at.asc())
        )
        if asin:
            stmt = stmt.where(Asin.asin == asin)
        if category:
            stmt = stmt.where(Asin.category == category)
        result = await self.db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    def _series_for_rows(
        self, rows: list[tuple[Asin, Snapshot]], metric: str, *, label: str, asin: str | None = None
    ) -> TrendSeries:
        resolver = _METRICS.get(metric, _METRICS["price"])
        day_values: dict[str, list[float]] = defaultdict(list)
        for _, snap in rows:
            value = resolver(snap)
            if value is None:
                continue
            day_values[snap.scraped_at.date().isoformat()].append(value)
        points = [
            TrendPoint(date=d, value=round(sum(vs) / len(vs), 2))
            for d, vs in sorted(day_values.items())
        ]
        return TrendSeries(label=label, asin=asin, points=points)

    def _window(
        self, interval: str, date_from: str | None, date_to: str | None
    ) -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        if interval == "custom" and date_from and date_to:
            start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            return start, end
        days = {"7": 7, "30": 30, "90": 90}.get(interval, 30)
        return now - timedelta(days=days), now
