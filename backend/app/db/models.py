"""SQLAlchemy ORM models for the analytics application."""
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
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


class User(Base):
    """A dashboard user. Login activity is retained for the user management view."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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


class SalesUpload(Base):
    """One uploaded sales report file. `content_hash` guards against re-uploading
    the exact same file twice (deduplication)."""

    __tablename__ = "sales_uploads"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_units: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_gross: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    records: Mapped[list["SalesRecord"]] = relationship(
        back_populates="upload_ref", cascade="all, delete-orphan"
    )


class SalesRecord(Base):
    """A single sales line item from an uploaded report."""

    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sales_uploads.id", ondelete="CASCADE"), index=True, nullable=False
    )
    asin: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    item_name: Mapped[str | None] = mapped_column(Text)  # from CSV; display prefers asins.product_name
    order_date: Mapped[date | None] = mapped_column(Date, index=True)
    units: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_units: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gross_sales: Mapped[float | None] = mapped_column(Numeric(14, 2))
    net_sales: Mapped[float | None] = mapped_column(Numeric(14, 2))
    category: Mapped[str | None] = mapped_column(Text)
    sub_category: Mapped[str | None] = mapped_column(Text)
    state_name: Mapped[str | None] = mapped_column(String(64), index=True)
    city: Mapped[str | None] = mapped_column(String(64))
    postal_code: Mapped[str | None] = mapped_column(String(16))

    upload_ref: Mapped["SalesUpload"] = relationship(back_populates="records")


class OperationalForecastUpload(Base):
    """One monthly operational plan and its original uploaded file."""

    __tablename__ = "operational_forecast_uploads"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    forecast_month: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    original_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    planned_units: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    po_value: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    total_budget: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)

    rows: Mapped[list["OperationalForecastRow"]] = relationship(
        back_populates="upload_ref", cascade="all, delete-orphan"
    )
    amendments: Mapped[list["OperationalForecastAmendment"]] = relationship(
        back_populates="forecast_ref", cascade="all, delete-orphan"
    )
    actual_uploads: Mapped[list["OperationalActualUpload"]] = relationship(
        back_populates="forecast_ref"
    )


class OperationalForecastAmendment(Base):
    """An immutable file that adds ASINs to an existing monthly target."""

    __tablename__ = "operational_forecast_amendments"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    forecast_upload_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("operational_forecast_uploads.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    effective_from: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    original_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    planned_units: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    po_value: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    total_budget: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)

    forecast_ref: Mapped["OperationalForecastUpload"] = relationship(
        back_populates="amendments"
    )
    rows: Mapped[list["OperationalForecastRow"]] = relationship(
        back_populates="amendment_ref"
    )


class OperationalForecastRow(Base):
    """One ASIN's targets and monthly spend budgets within a forecast."""

    __tablename__ = "operational_forecast_rows"
    __table_args__ = (UniqueConstraint("upload_id", "asin", name="uq_forecast_upload_asin"),)

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("operational_forecast_uploads.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    asin: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    short_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    effective_from: Mapped[date | None] = mapped_column(Date, index=True)
    source_amendment_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("operational_forecast_amendments.id", ondelete="SET NULL"),
        index=True,
    )
    daily_run_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    po_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    po_value: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    ccogs_budget: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    ads_budget: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    coupons_budget: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    reviews_budget: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    total_budget: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)

    upload_ref: Mapped["OperationalForecastUpload"] = relationship(back_populates="rows")
    amendment_ref: Mapped["OperationalForecastAmendment | None"] = relationship(
        back_populates="rows"
    )
    actual_rows: Mapped[list["OperationalActualRow"]] = relationship(
        back_populates="forecast_row_ref"
    )


class OperationalActualUpload(Base):
    """The single allowed actuals file for a reporting date."""

    __tablename__ = "operational_actual_uploads"

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    forecast_upload_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("operational_forecast_uploads.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    report_date: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    original_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_units: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    po_value: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    total_spend: Mapped[float] = mapped_column(Numeric(16, 2), default=0, nullable=False)

    forecast_ref: Mapped["OperationalForecastUpload"] = relationship(
        back_populates="actual_uploads"
    )
    rows: Mapped[list["OperationalActualRow"]] = relationship(
        back_populates="upload_ref", cascade="all, delete-orphan"
    )


class OperationalActualRow(Base):
    """One ASIN's actual units and spend on a reporting date."""

    __tablename__ = "operational_actual_rows"
    __table_args__ = (
        UniqueConstraint("upload_id", "forecast_row_id", name="uq_actual_upload_forecast_row"),
    )

    id: Mapped[int] = mapped_column(PK, primary_key=True, autoincrement=True)
    upload_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("operational_actual_uploads.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    forecast_row_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("operational_forecast_rows.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    actual_drr: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    po_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    ccogs_spend: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    ads_spend: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    coupons_spend: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    reviews_spend: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    total_spend: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    po_value: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)

    upload_ref: Mapped["OperationalActualUpload"] = relationship(back_populates="rows")
    forecast_row_ref: Mapped["OperationalForecastRow"] = relationship(
        back_populates="actual_rows"
    )
