import { useMemo, useState } from "react";
import {
  Boxes,
  Download,
  ExternalLink,
  IndianRupee,
  PackageX,
  Search,
  Star,
} from "lucide-react";
import { useDashboardProducts, useDashboardSummary } from "../api/hooks";
import { Card, KpiCard } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input, Select, Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { formatINR, formatNumber } from "../lib/utils";
import type { ProductCard } from "../api/types";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useDashboardSummary();
  const { data: products, isLoading: loadingProducts } = useDashboardProducts();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean) as string[])),
    [products]
  );

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (q && !`${p.asin} ${p.product_name}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (category && p.category !== category) return false;
      if (status === "in" && !p.in_stock) return false;
      if (status === "out" && p.in_stock) return false;
      if (minPrice && (p.price ?? 0) < Number(minPrice)) return false;
      if (maxPrice && (p.price ?? Infinity) > Number(maxPrice)) return false;
      return true;
    });
  }, [products, q, category, status, minPrice, maxPrice]);

  const downloadCsv = () => {
    const headers = [
      "ASIN",
      "Product Name",
      "Category",
      "Rating",
      "Positive",
      "Negative",
      "Total",
      "Price",
      "Status",
    ];
    const rows = filtered.map((p) => [
      p.asin,
      p.product_name,
      p.category ?? "",
      p.avg_rating ?? "",
      p.positive_rating ?? "",
      p.negative_rating ?? "",
      p.total_rating_cnt ?? "",
      p.price ?? "",
      p.in_stock ? "In Stock" : "Out of Stock",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Business Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Latest Amazon scraped metrics across your active catalog
        </p>
      </div>

      {/* KPI cards */}
      {loadingSummary ? (
        <Spinner label="Loading metrics…" />
      ) : (
        summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Active Products"
              value={summary.active_products}
              sub={`${summary.total_products} tracked`}
              icon={<Boxes size={18} />}
            />
            <KpiCard
              label="Avg Price"
              value={formatINR(summary.avg_price)}
              icon={<IndianRupee size={18} />}
              accent="rgba(16,185,129,0.15)"
            />
            <KpiCard
              label="Avg Rating"
              value={summary.avg_rating ? `${summary.avg_rating.toFixed(2)} ★` : "—"}
              sub={`${formatNumber(summary.total_reviews)} reviews`}
              icon={<Star size={18} />}
              accent="rgba(245,158,11,0.15)"
            />
            <KpiCard
              label="Inventory"
              value={`${summary.in_stock} In · ${summary.out_of_stock} Out`}
              sub="Buy Box availability"
              icon={<PackageX size={18} />}
              accent="rgba(244,63,94,0.15)"
            />
          </div>
        )
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Filters
          </span>
          <Button variant="primary" icon={<Download size={15} />} onClick={downloadCsv}>
            Download CSV
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <Input
              className="w-full pl-9"
              placeholder="Search by ASIN or product name..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="in">In Stock</option>
            <option value="out">Out of Stock</option>
          </Select>
          <Input
            className="w-24"
            placeholder="Min ₹"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            className="w-24"
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      </Card>

      {/* Product table */}
      <Card>
        {loadingProducts ? (
          <Spinner label="Loading products…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">ASIN</th>
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Rating</th>
                  <th className="px-5 py-3">Positive</th>
                  <th className="px-5 py-3">Negative</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <ProductRow key={p.asin} p={p} index={i + 1} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-[var(--muted)]">
                      No products match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Category breakdown */}
      {summary && summary.categories.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text)]">Category Breakdown</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.categories.map((c) => (
              <div
                key={c.category}
                className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--text)]">{c.category}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {c.product_count} products · {formatNumber(c.total_reviews)} reviews
                </p>
                <p className="mt-2 text-lg font-bold text-[var(--accent)]">
                  {c.avg_rating ? `${c.avg_rating.toFixed(2)} ★` : "—"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ratingVariant(rating: number | null): "green" | "amber" | "red" {
  if (rating === null) return "amber";
  if (rating >= 4) return "green";
  if (rating >= 3) return "amber";
  return "red";
}

function ProductRow({ p, index }: { p: ProductCard; index: number }) {
  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]">
      <td className="px-5 py-3 text-[var(--muted)]">{index}</td>
      <td className="px-5 py-3">
        <a
          href={p.amazon_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--text)] hover:text-[var(--accent)]"
        >
          {p.asin} <ExternalLink size={12} />
        </a>
      </td>
      <td className="px-5 py-3 text-[var(--text)]">{p.product_name}</td>
      <td className="px-5 py-3 text-[var(--muted)]">{p.category ?? "—"}</td>
      <td className="px-5 py-3">
        <Badge variant={ratingVariant(p.avg_rating)}>
          {p.avg_rating ? `${p.avg_rating.toFixed(1)} ★` : "—"}
        </Badge>
      </td>
      <td className="px-5 py-3 text-emerald-400">{formatNumber(p.positive_rating)}</td>
      <td className="px-5 py-3 text-rose-400">{formatNumber(p.negative_rating)}</td>
      <td className="px-5 py-3 text-[var(--text)]">{formatNumber(p.total_rating_cnt)}</td>
      <td className="px-5 py-3 text-[var(--text)]">{formatINR(p.price)}</td>
      <td className="px-5 py-3">
        {p.in_stock === null || p.in_stock === undefined ? (
          <Badge variant="gray">No Data</Badge>
        ) : (
          <Badge variant={p.in_stock ? "green" : "red"}>
            {p.in_stock ? "In Stock" : "Out of Stock"}
          </Badge>
        )}
      </td>
    </tr>
  );
}
