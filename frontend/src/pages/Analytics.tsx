import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useDashboardProducts, useRankings, useTrends } from "../api/hooks";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Select, Spinner } from "../components/ui/Spinner";
import { formatNumber } from "../lib/utils";

const METRICS = [
  { value: "price", label: "Price" },
  { value: "avg_rating", label: "Rating" },
  { value: "rating_count", label: "Rating Count" },
  { value: "positive", label: "Positive Reviews" },
  { value: "negative", label: "Negative Reviews" },
  { value: "stock", label: "Stock Availability" },
];

const INTERVALS = ["7", "30", "90"];

export default function Analytics() {
  const [metric, setMetric] = useState("price");
  const [interval, setInterval] = useState("30");
  const [asin, setAsin] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  const { data: products } = useDashboardProducts();
  const { data: trend, isLoading: loadingTrend } = useTrends({
    metric,
    interval,
    asin: asin || undefined,
    category: category || undefined,
  });
  const { data: rankings, isLoading: loadingRankings } = useRankings(metric, interval, order);

  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean) as string[])),
    [products]
  );

  const chartData = useMemo(() => {
    const series = trend?.series?.[0];
    return (series?.points ?? []).map((pt) => ({
      date: pt.date.slice(5), // MM-DD
      value: pt.value,
    }));
  }, [trend]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Business Analytics</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Trend analysis and rankings over time
        </p>
      </div>

      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>

          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {INTERVALS.map((d) => (
              <button
                key={d}
                onClick={() => setInterval(d)}
                className={`px-3.5 py-2 text-sm font-medium transition ${
                  interval === d
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:bg-[var(--panel-2)]"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <Select
            value={asin}
            onChange={(e) => {
              setAsin(e.target.value);
              if (e.target.value) setCategory("");
            }}
          >
            <option value="">All ASINs</option>
            {(products ?? []).map((p) => (
              <option key={p.asin} value={p.asin}>
                {p.asin} — {p.product_name}
              </option>
            ))}
          </Select>

          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value) setAsin("");
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Trend chart */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text)]">
          {METRICS.find((m) => m.value === metric)?.label} Trend ·{" "}
          {trend?.series?.[0]?.label ?? "—"}
        </h3>
        {loadingTrend ? (
          <Spinner label="Loading trend…" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted)]">No data for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} width={60} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Rankings */}
      <Card>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Rankings · {METRICS.find((m) => m.value === metric)?.label}
          </h3>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            <button
              onClick={() => setOrder("desc")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition ${
                order === "desc" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
              }`}
            >
              <TrendingUp size={13} /> Winners
            </button>
            <button
              onClick={() => setOrder("asc")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition ${
                order === "asc" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
              }`}
            >
              <TrendingDown size={13} /> Losers
            </button>
          </div>
        </div>
        {loadingRankings ? (
          <Spinner label="Loading rankings…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">ASIN</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Change</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rankings?.rows.map((r, i) => (
                  <tr
                    key={r.asin}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]"
                  >
                    <td className="px-5 py-3 text-[var(--muted)]">{i + 1}</td>
                    <td className="px-5 py-3 font-semibold text-[var(--text)]">{r.asin}</td>
                    <td className="px-5 py-3 text-[var(--text)]">{r.product_name}</td>
                    <td className="px-5 py-3 text-[var(--text)]">{formatNumber(r.value)}</td>
                    <td className="px-5 py-3">
                      {r.change === null ? (
                        <span className="text-[var(--muted)]">—</span>
                      ) : (
                        <span className={r.change >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {r.change >= 0 ? "+" : ""}
                          {formatNumber(r.change)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={r.in_stock ? "green" : "red"}>
                        {r.in_stock ? "In Stock" : "Out of Stock"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
