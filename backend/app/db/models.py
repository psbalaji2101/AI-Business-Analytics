"""SQLAlchemy ORM models: ASINs, snapshots, scrape runs."""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# BigInteger in production (Postgres); plain Integer on SQLite so rowid autoincrement works.
PK = BigInteger().with_variant(Integer, "sqlite")


class Asin(Base):
    __tablename__ = "asins"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    asin: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    product_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(Text)
    sub_category: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # True once the user manually edits the name -> the scraper won't overwrite it.
    name_is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    date_added: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    snapshots: Mapped[list["Snapshot"]] = relationship(
        back_populates="asin_ref", cascade="all, delete-orphan"
    )


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    asin_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("asins.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
    price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    total_rating_cnt: Mapped[int | None] = mapped_column(Integer)
    avg_rating: Mapped[float | None] = mapped_column(Numeric(3, 2))
    star_5: Mapped[int | None] = mapped_column(Integer)
    star_4: Mapped[int | None] = mapped_column(Integer)
    star_3: Mapped[int | None] = mapped_column(Integer)
    star_2: Mapped[int | None] = mapped_column(Integer)
    star_1: Mapped[int | None] = mapped_column(Integer)
    buy_box_available: Mapped[bool | None] = mapped_column(Boolean)
    in_stock: Mapped[bool | None] = mapped_column(Boolean)
    positive_rating: Mapped[int | None] = mapped_column(Integer)
    negative_rating: Mapped[int | None] = mapped_column(Integer)
    raw_payload: Mapped[dict | None] = mapped_column(JSON)

    asin_ref: Mapped["Asin"] = relationship(back_populates="snapshots")


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str | None] = mapped_column(String(20))  # success | partial | failed
    adapter: Mapped[str | None] = mapped_column(String(20))
    total: Mapped[int | None] = mapped_column(Integer)
    succeeded: Mapped[int | None] = mapped_column(Integer)
    failed: Mapped[int | None] = mapped_column(Integer)
    error_log: Mapped[dict | None] = mapped_column(JSON)
