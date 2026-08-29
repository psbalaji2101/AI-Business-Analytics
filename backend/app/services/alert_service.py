"""Build the current operational alert feed from product snapshots."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Asin, Snapshot
from app.schemas.alerts import AlertRow, AlertSummary, AlertsResponse
from app.services.snapshot_service import SnapshotService


class AlertService:
    """Derives operational alerts from product snapshots.

    The latest view lists current availability. Time-range views show changes
    detected within the selected period.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.snapshots = SnapshotService(db)

    async def list_alerts(
        self,
        *,
        interval: str = "latest",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> AlertsResponse:
        if interval == "latest":
            rows = await self._latest_alerts()
        else:
            start, end = self._window(interval, date_from, date_to)
            rows = await self._historical_alerts(start, end)

        rows.sort(key=lambda row: row.detected_at, reverse=True)
        counts = Counter(row.alert_type for row in rows)
        return AlertsResponse(
            rows=rows,
            summary=AlertSummary(
                total=len(rows),
                price_increased=counts["price_increased"],
                price_decreased=counts["price_decreased"],
                rating_increased=counts["rating_increased"],
                rating_decreased=counts["rating_decreased"],
                positive_reviews_increased=counts["positive_reviews_increased"],
                negative_reviews_increased=counts["negative_reviews_increased"],
                in_stock=counts["in_stock"],
                out_of_stock=counts["out_of_stock"],
            ),
        )

    async def _latest_alerts(self) -> list[AlertRow]:
        asins = list(
            (
                await self.db.scalars(
                    select(Asin)
                    .where(Asin.is_active.is_(True), Asin.is_deleted.is_(False))
                    .order_by(Asin.product_name)
                )
            ).all()
        )
        latest = await self.snapshots.latest_per_asin()
        rows: list[AlertRow] = []

        for asin in asins:
            current = latest.get(asin.id)
            if not current:
                continue

            base = dict(
                asin=asin.asin,
                product_name=asin.product_name,
                category=asin.category,
                amazon_url=f"{settings.amazon_base_url}{asin.asin}",
                detected_at=current.scraped_at,
            )
            previous = await self._previous_snapshot(asin.id, current.id)
            self._add_snapshot_alerts(rows, base, current, previous, include_stock=True)

        return rows

    async def _historical_alerts(
        self, start: datetime, end: datetime
    ) -> list[AlertRow]:
        """Return state changes detected within a time window.

        Snapshots before the range are loaded as baselines, so an event in the
        first selected scrape is compared with the immediately preceding scrape.
        """
        result = await self.db.execute(
            select(Asin, Snapshot)
            .join(Snapshot, Snapshot.asin_id == Asin.id)
            .where(
                Asin.is_active.is_(True),
                Asin.is_deleted.is_(False),
                Snapshot.scraped_at <= end,
            )
            .order_by(Asin.id, Snapshot.scraped_at, Snapshot.id)
        )
        rows: list[AlertRow] = []
        previous_by_asin: dict[int, Snapshot] = {}

        for asin, current in result.all():
            previous = previous_by_asin.get(asin.id)
            previous_by_asin[asin.id] = current
            if self._as_utc(current.scraped_at) < start:
                continue

            base = dict(
                asin=asin.asin,
                product_name=asin.product_name,
                category=asin.category,
                amazon_url=f"{settings.amazon_base_url}{asin.asin}",
                detected_at=current.scraped_at,
            )
            # In a historical feed, stock appears only on its first known state
            # or when it changes, rather than repeating every scheduled scrape.
            include_stock = previous is None or current.in_stock != previous.in_stock
            self._add_snapshot_alerts(rows, base, current, previous, include_stock=include_stock)

        return rows

    @classmethod
    def _add_snapshot_alerts(
        cls,
        rows: list[AlertRow],
        base: dict,
        current: Snapshot,
        previous: Snapshot | None,
        *,
        include_stock: bool,
    ) -> None:
        """Add availability and directional metric alerts for one snapshot."""
        if include_stock and current.in_stock is not None:
            previous_stock = (
                1.0
                if previous and previous.in_stock is True
                else 0.0
                if previous and previous.in_stock is False
                else None
            )
            rows.append(
                AlertRow(
                    **base,
                    alert_type="in_stock" if current.in_stock else "out_of_stock",
                    in_stock=current.in_stock,
                    previous_value=previous_stock,
                )
            )

        if not previous:
            return

        cls._add_change_alert(
            rows,
            base,
            current.price,
            previous.price,
            "price_increased",
            "price_decreased",
            current.in_stock,
        )
        cls._add_change_alert(
            rows,
            base,
            current.avg_rating,
            previous.avg_rating,
            "rating_increased",
            "rating_decreased",
            current.in_stock,
        )
        cls._add_change_alert(
            rows,
            base,
            current.positive_rating,
            previous.positive_rating,
            "positive_reviews_increased",
            None,
            current.in_stock,
        )
        cls._add_change_alert(
            rows,
            base,
            current.negative_rating,
            previous.negative_rating,
            "negative_reviews_increased",
            None,
            current.in_stock,
        )

    @staticmethod
    def _add_change_alert(
        rows: list[AlertRow],
        base: dict,
        current: object,
        previous: object,
        increased_type: str,
        decreased_type: str | None,
        in_stock: bool | None,
    ) -> None:
        """Append a numeric direction alert when both values exist and differ."""
        if current is None or previous is None:
            return
        current_value, previous_value = float(current), float(previous)
        change = round(current_value - previous_value, 2)
        if change == 0:
            return
        alert_type = increased_type if change > 0 else decreased_type
        if not alert_type:
            return
        rows.append(
            AlertRow(
                **base,
                alert_type=alert_type,
                current_value=current_value,
                previous_value=previous_value,
                change=change,
                in_stock=in_stock,
            )
        )

    async def _previous_snapshot(self, asin_id: int, before_id: int) -> Snapshot | None:
        return await self.db.scalar(
            select(Snapshot)
            .where(Snapshot.asin_id == asin_id, Snapshot.id < before_id)
            .order_by(Snapshot.id.desc())
            .limit(1)
        )

    @staticmethod
    def _window(
        interval: str, date_from: str | None, date_to: str | None
    ) -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        if interval == "custom" and date_from and date_to:
            start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            # Date-only ranges should include every scrape on the end date.
            end = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            return start, end + timedelta(days=1) - timedelta(microseconds=1)
        hours = {"24h": 24, "7": 24 * 7, "30": 24 * 30, "90": 24 * 90}.get(
            interval, 24 * 7
        )
        return now - timedelta(hours=hours), now

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        """Normalise SQLite's naive datetime values for range comparisons."""
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
