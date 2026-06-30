"""ASIN business logic — CRUD, search, filtering, pagination, bulk upload."""
import csv
import io

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Asin
from app.schemas.asin import AsinCreate, AsinUpdate, BulkUploadResult


class AsinService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        *,
        q: str | None = None,
        category: str | None = None,
        sub_category: str | None = None,
        active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
        sort: str = "-date_added",
    ) -> tuple[list[Asin], int]:
        stmt = select(Asin).where(Asin.is_deleted.is_(False))
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Asin.asin.ilike(like) | Asin.product_name.ilike(like))
        if category:
            stmt = stmt.where(Asin.category == category)
        if sub_category:
            stmt = stmt.where(Asin.sub_category == sub_category)
        if active is not None:
            stmt = stmt.where(Asin.is_active.is_(active))

        total = await self.db.scalar(select(func.count()).select_from(stmt.subquery()))

        # Sorting: "-field" => desc, "field" => asc
        desc = sort.startswith("-")
        field_name = sort.lstrip("-")
        column = getattr(Asin, field_name, Asin.date_added)
        stmt = stmt.order_by(column.desc() if desc else column.asc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        rows = (await self.db.scalars(stmt)).all()
        return list(rows), int(total or 0)

    async def get(self, asin_id: int) -> Asin | None:
        return await self.db.get(Asin, asin_id)

    async def get_by_asin(self, asin: str) -> Asin | None:
        return await self.db.scalar(select(Asin).where(Asin.asin == asin))

    async def create(self, payload: AsinCreate) -> Asin:
        # A name typed by the user is theirs -> protect it from scraper overwrites.
        obj = Asin(**payload.model_dump(), name_is_custom=True)
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, asin_id: int, payload: AsinUpdate) -> Asin | None:
        obj = await self.get(asin_id)
        if not obj:
            return None
        fields = payload.model_dump(exclude_unset=True)
        for key, value in fields.items():
            setattr(obj, key, value)
        # A manual name edit becomes "custom" so the scraper won't overwrite it.
        if fields.get("product_name"):
            obj.name_is_custom = True
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def revive(self, obj: Asin, payload: AsinCreate) -> Asin:
        """Re-activate a previously soft-deleted ASIN with new details."""
        obj.is_deleted = False
        obj.name_is_custom = True  # the re-add name was typed by the user
        for key, value in payload.model_dump().items():
            setattr(obj, key, value)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, asin_id: int) -> bool:
        """Hard delete: remove the ASIN and its snapshots (FK cascade)."""
        obj = await self.get(asin_id)
        if not obj:
            return False
        await self.db.delete(obj)
        await self.db.commit()
        return True

    async def set_tracking(self, asin_id: int, is_active: bool) -> Asin | None:
        obj = await self.get(asin_id)
        if not obj:
            return None
        obj.is_active = is_active
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def bulk_upload(self, content: bytes) -> BulkUploadResult:
        created, skipped, errors = 0, 0, []
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        for i, row in enumerate(reader, start=2):
            asin = (row.get("asin") or row.get("ASIN") or "").strip()
            if not asin:
                errors.append(f"Row {i}: missing ASIN")
                continue
            exists = await self.db.scalar(select(Asin).where(Asin.asin == asin))
            if exists:
                skipped += 1
                continue
            name = (row.get("product_name") or row.get("Product Name") or "").strip()
            self.db.add(
                Asin(
                    asin=asin,
                    product_name=name or asin,
                    # A real name in the CSV is kept; a blank one lets the scraper fill it.
                    name_is_custom=bool(name),
                    category=(row.get("category") or row.get("Category") or "").strip() or None,
                    sub_category=(row.get("sub_category") or row.get("Sub Category") or "").strip()
                    or None,
                )
            )
            created += 1
        await self.db.commit()
        return BulkUploadResult(created=created, skipped=skipped, errors=errors)
