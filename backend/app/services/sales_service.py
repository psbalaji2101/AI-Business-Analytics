"""Sales business logic — CSV parsing, dedup, and aggregations for the Sales page."""
import csv
import hashlib
import io
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asin, SalesRecord, SalesUpload
from app.schemas.sales import (
    SalesByAsin,
    SalesByState,
    SalesSummary,
    SalesUploadResult,
)


def _num(value: str | None) -> float:
    """Parse a numeric CSV cell; blank/garbage -> 0.0."""
    if not value:
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return 0.0


def _int(value: str | None) -> int:
    return int(_num(value))


def _parse_date(day: str | None, month: str | None, year: str | None) -> date | None:
    try:
        d, m, y = int(day), int(month), int(year)
        return date(y, m, d)
    except (TypeError, ValueError):
        return None


class SalesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---------------- Upload + dedup ----------------
    async def upload(self, filename: str, content: bytes) -> SalesUploadResult:
        # File-level dedup: the SHA-256 of the raw bytes uniquely identifies a file.
        # Re-uploading the identical file is a no-op (avoids duplicating every row).
        content_hash = hashlib.sha256(content).hexdigest()
        existing = await self.db.scalar(
            select(SalesUpload).where(SalesUpload.content_hash == content_hash)
        )
        if existing:
            return SalesUploadResult(
                upload_id=existing.id,
                filename=existing.filename,
                duplicate=True,
                inserted=0,
                total_units=existing.total_units,
                total_gross=float(existing.total_gross or 0),
                errors=[f"This file was already uploaded on {existing.uploaded_at:%Y-%m-%d %H:%M}."],
            )

        upload = SalesUpload(filename=filename, content_hash=content_hash)
        self.db.add(upload)
        await self.db.flush()  # get upload.id

        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        inserted, total_units, total_gross = 0, 0, 0.0
        errors: list[str] = []

        for i, row in enumerate(reader, start=2):
            asin = (row.get("asin") or row.get("ASIN") or "").strip()
            if not asin:
                errors.append(f"Row {i}: missing ASIN")
                continue
            units = _int(row.get("grossUnits"))
            gross = _num(row.get("grossSales"))
            self.db.add(
                SalesRecord(
                    upload_id=upload.id,
                    asin=asin,
                    item_name=(row.get("itemName") or "").strip() or None,
                    order_date=_parse_date(
                        row.get("orderDay"), row.get("orderMonth"), row.get("orderYear")
                    ),
                    units=units,
                    net_units=_int(row.get("netUnits")),
                    gross_sales=gross,
                    net_sales=_num(row.get("netSales")),
                    category=(row.get("category") or "").strip() or None,
                    sub_category=(row.get("subcategory") or "").strip() or None,
                    state_name=(row.get("stateName") or "").strip().upper() or None,
                    city=(row.get("city") or "").strip() or None,
                    postal_code=(row.get("postalCode") or "").strip() or None,
                )
            )
            inserted += 1
            total_units += units
            total_gross += gross

        if inserted == 0:
            # Nothing usable — roll back the empty upload row so a fixed re-upload works.
            await self.db.rollback()
            return SalesUploadResult(
                upload_id=None,
                filename=filename,
                duplicate=False,
                inserted=0,
                total_units=0,
                total_gross=0.0,
                errors=errors or ["No valid rows found in the file."],
            )

        upload.row_count = inserted
        upload.total_units = total_units
        upload.total_gross = round(total_gross, 2)
        await self.db.commit()
        await self.db.refresh(upload)

        return SalesUploadResult(
            upload_id=upload.id,
            filename=filename,
            duplicate=False,
            inserted=inserted,
            total_units=total_units,
            total_gross=round(total_gross, 2),
            errors=errors,
        )

    # ---------------- Shared filter ----------------
    def _apply_filters(
        self,
        stmt,
        *,
        asin: str | None,
        date_from: date | None,
        date_to: date | None,
    ):
        if asin:
            stmt = stmt.where(SalesRecord.asin == asin)
        if date_from:
            stmt = stmt.where(SalesRecord.order_date >= date_from)
        if date_to:
            stmt = stmt.where(SalesRecord.order_date <= date_to)
        return stmt

    # ---------------- Aggregations ----------------
    async def summary(
        self, *, asin: str | None = None, date_from: date | None = None, date_to: date | None = None
    ) -> SalesSummary:
        stmt = select(
            func.coalesce(func.sum(SalesRecord.units), 0),
            func.coalesce(func.sum(SalesRecord.gross_sales), 0),
            func.count(SalesRecord.id),
            func.count(func.distinct(SalesRecord.asin)),
            func.count(func.distinct(SalesRecord.state_name)),
            func.min(SalesRecord.order_date),
            func.max(SalesRecord.order_date),
        )
        stmt = self._apply_filters(stmt, asin=asin, date_from=date_from, date_to=date_to)
        row = (await self.db.execute(stmt)).one()
        return SalesSummary(
            total_units=int(row[0] or 0),
            total_gross=round(float(row[1] or 0), 2),
            total_orders=int(row[2] or 0),
            distinct_asins=int(row[3] or 0),
            distinct_states=int(row[4] or 0),
            date_from=row[5],
            date_to=row[6],
        )

    async def by_asin(
        self, *, asin: str | None = None, date_from: date | None = None, date_to: date | None = None
    ) -> list[SalesByAsin]:
        # Product name comes from the ASIN catalog (Manage page) and is NOT overridden
        # by the CSV; fall back to the CSV item name only when the ASIN isn't tracked.
        stmt = (
            select(
                SalesRecord.asin,
                func.coalesce(
                    func.max(Asin.product_name), func.max(SalesRecord.item_name), SalesRecord.asin
                ),
                func.coalesce(func.sum(SalesRecord.units), 0),
                func.coalesce(func.sum(SalesRecord.gross_sales), 0),
                func.count(SalesRecord.id),
            )
            .outerjoin(
                Asin, (Asin.asin == SalesRecord.asin) & (Asin.is_deleted.is_(False))
            )
            .group_by(SalesRecord.asin)
            .order_by(func.sum(SalesRecord.gross_sales).desc())
        )
        stmt = self._apply_filters(stmt, asin=asin, date_from=date_from, date_to=date_to)
        rows = (await self.db.execute(stmt)).all()
        return [
            SalesByAsin(
                asin=r[0],
                product_name=r[1] or r[0],
                units=int(r[2] or 0),
                gross_sales=round(float(r[3] or 0), 2),
                orders=int(r[4] or 0),
            )
            for r in rows
        ]

    async def by_state(
        self, *, asin: str | None = None, date_from: date | None = None, date_to: date | None = None
    ) -> list[SalesByState]:
        stmt = (
            select(
                SalesRecord.state_name,
                func.coalesce(func.sum(SalesRecord.units), 0),
                func.coalesce(func.sum(SalesRecord.gross_sales), 0),
                func.count(SalesRecord.id),
            )
            .where(SalesRecord.state_name.is_not(None))
            .group_by(SalesRecord.state_name)
            .order_by(func.sum(SalesRecord.units).desc())
        )
        stmt = self._apply_filters(stmt, asin=asin, date_from=date_from, date_to=date_to)
        rows = (await self.db.execute(stmt)).all()
        return [
            SalesByState(
                state_name=r[0],
                units=int(r[1] or 0),
                gross_sales=round(float(r[2] or 0), 2),
                orders=int(r[3] or 0),
            )
            for r in rows
        ]

    async def list_uploads(self) -> list[SalesUpload]:
        # Most recent first, capped at the 10 latest uploads.
        rows = await self.db.scalars(
            select(SalesUpload).order_by(SalesUpload.uploaded_at.desc()).limit(10)
        )
        return list(rows)

    async def delete_upload(self, upload_id: int) -> bool:
        obj = await self.db.get(SalesUpload, upload_id)
        if not obj:
            return False
        await self.db.delete(obj)  # records cascade
        await self.db.commit()
        return True
