"""API schemas for monthly operational plans and daily actuals."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class OperationalUploadResult(BaseModel):
    upload_id: int
    filename: str
    row_count: int
    period: date
    units: float
    po_value: float
    spend: float


class ForecastUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    forecast_month: date
    filename: str
    uploaded_at: datetime
    row_count: int
    planned_units: float
    po_value: float
    total_budget: float


class ActualUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    forecast_upload_id: int
    report_date: date
    filename: str
    uploaded_at: datetime
    row_count: int
    actual_units: float
    po_value: float
    total_spend: float


class SpendComponent(BaseModel):
    planned: float
    actual: float
    adjusted_budget: float
    adjusted_variance: float


class SpendBreakdown(BaseModel):
    ccogs: SpendComponent
    ads: SpendComponent
    coupons: SpendComponent
    reviews: SpendComponent


class OperationalMetrics(BaseModel):
    planned_units: float
    actual_units: float
    unit_variance: float
    unit_achievement_pct: float | None
    planned_po_value: float
    actual_po_value: float
    po_value_variance: float
    planned_spend: float
    actual_spend: float
    nominal_spend_variance: float
    volume_adjusted_budget: float
    adjusted_spend_variance: float
    planned_cost_per_unit: float | None
    actual_cost_per_unit: float | None
    planned_spend_utilization_pct: float | None
    actual_spend_utilization_pct: float | None
    contribution_value: float
    contribution_margin_pct: float | None
    status: str
    spend_breakdown: SpendBreakdown


class OperationalTimelinePoint(BaseModel):
    date: date
    expected_units: float
    actual_units: float
    cumulative_expected_units: float
    cumulative_actual_units: float
    planned_spend: float
    actual_spend: float
    cumulative_planned_spend: float
    cumulative_actual_spend: float
    cumulative_adjusted_budget: float


class AsinOperationalMetrics(OperationalMetrics):
    asin: str
    short_name: str
    category: str
    timeline: list[OperationalTimelinePoint]


class CategoryOperationalMetrics(OperationalMetrics):
    category: str
    asins: list[AsinOperationalMetrics]
    timeline: list[OperationalTimelinePoint]


class OperationalDashboard(BaseModel):
    date_from: date | None
    date_to: date | None
    tolerance_pct: float = 5
    covered_days: int
    summary: OperationalMetrics
    categories: list[CategoryOperationalMetrics]
    timeline: list[OperationalTimelinePoint]
