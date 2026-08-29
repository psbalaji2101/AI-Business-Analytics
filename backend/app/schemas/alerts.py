"""Pydantic schemas for the operational product alerts feed."""
from datetime import datetime

from pydantic import BaseModel


class AlertRow(BaseModel):
    """One current product state or change detected between the two latest snapshots."""

    alert_type: str
    asin: str
    product_name: str
    category: str | None = None
    amazon_url: str
    current_value: float | None = None
    previous_value: float | None = None
    change: float | None = None
    in_stock: bool | None = None
    detected_at: datetime


class AlertSummary(BaseModel):
    total: int
    price_increased: int
    price_decreased: int
    rating_increased: int
    rating_decreased: int
    positive_reviews_increased: int
    negative_reviews_increased: int
    in_stock: int
    out_of_stock: int


class AlertsResponse(BaseModel):
    rows: list[AlertRow]
    summary: AlertSummary
