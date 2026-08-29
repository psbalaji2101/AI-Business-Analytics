"""Pydantic schemas for snapshots, dashboard, analytics, and AI."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---------- Snapshot ----------
class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asin_id: int
    scraped_at: datetime
    price: float | None = None
    currency: str = "INR"
    total_rating_cnt: int | None = None
    avg_rating: float | None = None
    star_5: int | None = None
    star_4: int | None = None
    star_3: int | None = None
    star_2: int | None = None
    star_1: int | None = None
    buy_box_available: bool | None = None
    in_stock: bool | None = None
    positive_rating: int | None = None
    negative_rating: int | None = None


# ---------- Dashboard ----------
class ProductCard(BaseModel):
    asin: str
    product_name: str
    category: str | None = None
    sub_category: str | None = None
    amazon_url: str
    price: float | None = None
    avg_rating: float | None = None
    total_rating_cnt: int | None = None
    positive_rating: int | None = None
    negative_rating: int | None = None
    in_stock: bool | None = None
    price_change: float | None = None
    review_velocity: float | None = None
    rating_growth: float | None = None
    last_scraped_at: datetime | None = None


class CategoryBreakdown(BaseModel):
    category: str
    product_count: int
    avg_rating: float | None = None
    total_reviews: int | None = None


class DashboardSummary(BaseModel):
    total_products: int
    active_products: int
    in_stock: int
    out_of_stock: int
    avg_price: float | None = None
    avg_rating: float | None = None
    total_reviews: int | None = None
    categories: list[CategoryBreakdown]


# ---------- Analytics (trends / compare / rankings) ----------
class TrendPoint(BaseModel):
    date: str
    value: float | None = None


class TrendSeries(BaseModel):
    label: str
    asin: str | None = None
    points: list[TrendPoint]


class TrendResponse(BaseModel):
    metric: str
    interval: str
    series: list[TrendSeries]


class RankingRow(BaseModel):
    asin: str
    product_name: str
    value: float | None = None
    change: float | None = None
    in_stock: bool | None = None


class RankingResponse(BaseModel):
    metric: str
    rows: list[RankingRow]


# ---------- AI ----------
class InsightOut(BaseModel):
    headline: str
    details: list[str]
    generated_at: datetime


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    data: dict | None = None
