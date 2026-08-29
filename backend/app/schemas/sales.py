"""Pydantic schemas for the Sales module (upload, aggregations)."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SalesUploadResult(BaseModel):
    """Returned after a file upload. `duplicate=True` means the exact same file
    was already uploaded before and no rows were inserted."""

    upload_id: int | None
    filename: str
    duplicate: bool
    inserted: int
    total_units: int
    total_gross: float
    errors: list[str] = []


class SalesUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    uploaded_at: datetime
    row_count: int
    total_units: int
    total_gross: float | None


class SalesSummary(BaseModel):
    total_units: int
    total_gross: float
    total_orders: int
    distinct_asins: int
    distinct_states: int
    date_from: date | None
    date_to: date | None


class SalesByAsin(BaseModel):
    asin: str
    product_name: str
    units: int
    gross_sales: float
    orders: int


class SalesByState(BaseModel):
    state_name: str
    units: int
    gross_sales: float
    orders: int
