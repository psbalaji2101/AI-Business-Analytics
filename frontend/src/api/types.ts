// Mirrors backend Pydantic schemas (the API contract).

export interface User {
  id?: number | null;
  email: string;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface TokenResponse {
  token: string;
  user: User;
}

export interface Asin {
  id: number;
  asin: string;
  product_name: string;
  category: string | null;
  sub_category: string | null;
  is_active: boolean;
  is_deleted: boolean;
  date_added: string;
  last_scraped_at: string | null;
}

export interface PaginatedAsins {
  items: Asin[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductCard {
  asin: string;
  product_name: string;
  category: string | null;
  sub_category: string | null;
  amazon_url: string;
  price: number | null;
  avg_rating: number | null;
  total_rating_cnt: number | null;
  positive_rating: number | null;
  negative_rating: number | null;
  in_stock: boolean | null;
  price_change: number | null;
  review_velocity: number | null;
  rating_growth: number | null;
  last_scraped_at: string | null;
}

export interface DashboardSummary {
  total_products: number;
  active_products: number;
  in_stock: number;
  out_of_stock: number;
  avg_price: number | null;
  avg_rating: number | null;
  total_reviews: number | null;
  categories: {
    category: string;
    product_count: number;
    avg_rating: number | null;
    total_reviews: number | null;
  }[];
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface TrendSeries {
  label: string;
  asin: string | null;
  points: TrendPoint[];
}

export interface TrendResponse {
  metric: string;
  interval: string;
  series: TrendSeries[];
}

export interface RankingRow {
  asin: string;
  product_name: string;
  value: number | null;
  change: number | null;
  in_stock: boolean | null;
}

export interface RankingResponse {
  metric: string;
  rows: RankingRow[];
}

// ---------------- Alerts ----------------
export type AlertType =
  | "price_increased"
  | "price_decreased"
  | "rating_increased"
  | "rating_decreased"
  | "positive_reviews_increased"
  | "negative_reviews_increased"
  | "in_stock"
  | "out_of_stock";

export interface AlertRow {
  alert_type: AlertType;
  asin: string;
  product_name: string;
  category: string | null;
  amazon_url: string;
  current_value: number | null;
  previous_value: number | null;
  change: number | null;
  in_stock: boolean | null;
  detected_at: string;
}

export interface AlertSummary {
  total: number;
  price_increased: number;
  price_decreased: number;
  rating_increased: number;
  rating_decreased: number;
  positive_reviews_increased: number;
  negative_reviews_increased: number;
  in_stock: number;
  out_of_stock: number;
}

export interface AlertsResponse {
  rows: AlertRow[];
  summary: AlertSummary;
}

// ---------------- Users ----------------
export interface ManagedUser {
  id: number;
  email: string;
  created_at: string;
  last_login_at: string | null;
}

export interface ScrapeRun {
  status: "success" | "partial" | "failed";
  adapter: string | null;
  total: number;
  succeeded: number;
  failed: number;
}

// ---------------- Sales ----------------
export interface SalesUploadResult {
  upload_id: number | null;
  filename: string;
  duplicate: boolean;
  inserted: number;
  total_units: number;
  total_gross: number;
  errors: string[];
}

export interface SalesUpload {
  id: number;
  filename: string;
  uploaded_at: string;
  row_count: number;
  total_units: number;
  total_gross: number | null;
}

export interface SalesSummary {
  total_units: number;
  total_gross: number;
  total_orders: number;
  distinct_asins: number;
  distinct_states: number;
  date_from: string | null;
  date_to: string | null;
}

export interface SalesByAsin {
  asin: string;
  product_name: string;
  units: number;
  gross_sales: number;
  orders: number;
}

export interface SalesByState {
  state_name: string;
  units: number;
  gross_sales: number;
  orders: number;
}

// ---------------- Operational Analytics ----------------
export interface OperationalUploadResult {
  upload_id: number;
  filename: string;
  row_count: number;
  period: string;
  units: number;
  po_value: number;
  spend: number;
}

export interface OperationalForecastUpload {
  id: number;
  forecast_month: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
  planned_units: number;
  po_value: number;
  total_budget: number;
}

export interface OperationalActualUpload {
  id: number;
  forecast_upload_id: number;
  report_date: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
  actual_units: number;
  po_value: number;
  total_spend: number;
}

export interface OperationalSpendComponent {
  planned: number;
  actual: number;
  adjusted_budget: number;
  adjusted_variance: number;
}

export interface OperationalMetrics {
  planned_units: number;
  actual_units: number;
  unit_variance: number;
  unit_achievement_pct: number | null;
  planned_po_value: number;
  actual_po_value: number;
  po_value_variance: number;
  planned_spend: number;
  actual_spend: number;
  nominal_spend_variance: number;
  volume_adjusted_budget: number;
  adjusted_spend_variance: number;
  planned_cost_per_unit: number | null;
  actual_cost_per_unit: number | null;
  planned_spend_utilization_pct: number | null;
  actual_spend_utilization_pct: number | null;
  contribution_value: number;
  contribution_margin_pct: number | null;
  status: "healthy" | "efficient_but_behind" | "overspend" | "no_sales" | "no_target";
  spend_breakdown: {
    ccogs: OperationalSpendComponent;
    ads: OperationalSpendComponent;
    coupons: OperationalSpendComponent;
    reviews: OperationalSpendComponent;
  };
}

export interface AsinOperationalMetrics extends OperationalMetrics {
  asin: string;
  short_name: string;
  category: string;
  timeline: OperationalTimelinePoint[];
}

export interface CategoryOperationalMetrics extends OperationalMetrics {
  category: string;
  asins: AsinOperationalMetrics[];
  timeline: OperationalTimelinePoint[];
}

export interface OperationalTimelinePoint {
  date: string;
  expected_units: number;
  actual_units: number;
  cumulative_expected_units: number;
  cumulative_actual_units: number;
  planned_spend: number;
  actual_spend: number;
  cumulative_planned_spend: number;
  cumulative_actual_spend: number;
  cumulative_adjusted_budget: number;
}

export interface OperationalDashboard {
  date_from: string | null;
  date_to: string | null;
  tolerance_pct: number;
  covered_days: number;
  summary: OperationalMetrics;
  categories: CategoryOperationalMetrics[];
  timeline: OperationalTimelinePoint[];
}
