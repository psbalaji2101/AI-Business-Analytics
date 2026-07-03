// Mirrors backend Pydantic schemas (the API contract).

export interface User {
  email: string;
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
