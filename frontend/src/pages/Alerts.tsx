import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Download,
  ExternalLink,
  PackageCheck,
  PackageX,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useAlerts } from "../api/hooks";
import { Badge } from "../components/ui/Badge";
import { Card, KpiCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Spinner } from "../components/ui/Spinner";
import { formatDateTime, formatINR, formatNumber } from "../lib/utils";
import type { AlertRow, AlertType } from "../api/types";

type AlertFilter = "" | AlertType;
type SortKey = "detected_at" | "product" | "category" | "alert" | "current" | "previous" | "change";
type SortDirection = "asc" | "desc";
type AlertInterval = "latest" | "24h" | "7" | "30" | "90" | "custom";
type CustomField = "current" | "previous" | "change" | "stock";
type CustomOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

interface CustomRule {
  id: number;
  field: CustomField;
  operator: CustomOperator;
  value: string;
}

const ALERT_TYPE_OPTIONS: { value: AlertFilter; label: string }[] = [
  { value: "", label: "All signals" },
  { value: "positive_reviews_increased", label: "Positive reviews increased" },
  { value: "negative_reviews_increased", label: "Negative reviews increased" },
  { value: "price_increased", label: "Price hiked" },
  { value: "price_decreased", label: "Price lowered" },
  { value: "rating_increased", label: "Rating increased" },
  { value: "rating_decreased", label: "Rating decreased" },
  { value: "in_stock", label: "Products available" },
  { value: "out_of_stock", label: "Out of stock" },
];

const TIME_RANGE_OPTIONS: { value: AlertInterval; label: string }[] = [
  { value: "latest", label: "Latest check" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom date range" },
];

const RULE_FIELDS: { value: CustomField; label: string }[] = [
  { value: "current", label: "Current value" },
  { value: "previous", label: "Previous value" },
  { value: "change", label: "Change" },
  { value: "stock", label: "Stock status" },
];

const RULE_OPERATORS: { value: CustomOperator; label: string }[] = [
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
];

const TYPE_META: Record<AlertType, { label: string; variant: "green" | "red" | "amber" | "violet" }> = {
  positive_reviews_increased: { label: "Positive reviews increased", variant: "green" },
  negative_reviews_increased: { label: "Negative reviews increased", variant: "red" },
  price_increased: { label: "Price hiked", variant: "amber" },
  price_decreased: { label: "Price lowered", variant: "green" },
  rating_increased: { label: "Rating increased", variant: "green" },
  rating_decreased: { label: "Rating decreased", variant: "red" },
  in_stock: { label: "Available", variant: "green" },
  out_of_stock: { label: "Out of stock", variant: "red" },
};

function isAvailability(row: AlertRow) {
  return row.alert_type === "in_stock" || row.alert_type === "out_of_stock";
}

function isPrice(row: AlertRow) {
  return row.alert_type === "price_increased" || row.alert_type === "price_decreased";
}

function isRating(row: AlertRow) {
  return row.alert_type === "rating_increased" || row.alert_type === "rating_decreased";
}

function metricValue(row: AlertRow, value: number | null): string {
  if (isAvailability(row)) return value === null ? "—" : value === 1 ? "In Stock" : "Out of Stock";
  if (isPrice(row)) return formatINR(value);
  if (isRating(row)) return value === null ? "—" : `${value.toFixed(2)} ★`;
  return formatNumber(value);
}

function changeValue(row: AlertRow): string {
  if (isAvailability(row)) {
    if (row.previous_value === null) return "First tracked state";
    return row.previous_value === (row.in_stock ? 1 : 0) ? "No change" : "Status changed";
  }
  if (row.change === null) return "—";
  const prefix = row.change > 0 ? "+" : "";
  if (isPrice(row)) return `${prefix}${formatINR(row.change)}`;
  if (isRating(row)) return `${prefix}${row.change.toFixed(2)} ★`;
  return `${prefix}${formatNumber(row.change)}`;
}

function sortValue(row: AlertRow, key: SortKey): string | number {
  switch (key) {
    case "product":
      return row.product_name.toLowerCase();
    case "category":
      return (row.category ?? "").toLowerCase();
    case "alert":
      return TYPE_META[row.alert_type].label;
    case "current":
      return isAvailability(row) ? (row.in_stock ? 1 : 0) : row.current_value ?? Number.NEGATIVE_INFINITY;
    case "previous":
      return row.previous_value ?? Number.NEGATIVE_INFINITY;
    case "change":
      return row.change ?? Number.NEGATIVE_INFINITY;
    case "detected_at":
      return new Date(row.detected_at).getTime();
  }
}

function ruleValue(row: AlertRow, field: CustomField): number | null {
  if (field === "stock") return row.in_stock === null ? null : row.in_stock ? 1 : 0;
  if (field === "current") return isAvailability(row) ? (row.in_stock ? 1 : 0) : row.current_value;
  if (field === "previous") return row.previous_value;
  return row.change;
}

function matchesCustomRule(row: AlertRow, rule: CustomRule): boolean {
  if (!rule.value) return true;
  if (rule.field === "stock") {
    const expectedInStock = rule.value === "in_stock";
    return rule.operator === "neq"
      ? row.in_stock !== expectedInStock
      : row.in_stock === expectedInStock;
  }

  const value = ruleValue(row, rule.field);
  const target = Number(rule.value);
  if (value === null || Number.isNaN(target)) return false;
  switch (rule.operator) {
    case "gt": return value > target;
    case "gte": return value >= target;
    case "lt": return value < target;
    case "lte": return value <= target;
    case "eq": return value === target;
    case "neq": return value !== target;
  }
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function Alerts() {
  const [q, setQ] = useState("");
  const [alertType, setAlertType] = useState<AlertFilter>("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [interval, setInterval] = useState<AlertInterval>("latest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("detected_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const nextRuleId = useRef(0);
  const rangeReady = interval !== "custom" || Boolean(dateFrom && dateTo);
  const alertParams = useMemo(
    () => ({
      interval,
      ...(interval === "custom" && dateFrom && dateTo
        ? { date_from: dateFrom, date_to: dateTo }
        : {}),
    }),
    [interval, dateFrom, dateTo]
  );
  const { data, isLoading } = useAlerts(alertParams, rangeReady);

  const catalogCategories = useMemo(
    () => Array.from(new Set((data?.rows ?? []).map((row) => row.category).filter(Boolean) as string[])).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data?.rows ?? [])
      .filter((row) => {
        if (alertType && row.alert_type !== alertType) return false;
        if (catalogCategory && row.category !== catalogCategory) return false;
        if (!customRules.every((rule) => matchesCustomRule(row, rule))) return false;
        return !query || `${row.asin} ${row.product_name}`.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const left = sortValue(a, sortKey);
        const right = sortValue(b, sortKey);
        const comparison = typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [data, q, alertType, catalogCategory, customRules, sortKey, sortDirection]);

  const clearFilters = () => {
    setQ("");
    setAlertType("");
    setCatalogCategory("");
    setInterval("latest");
    setDateFrom("");
    setDateTo("");
    setCustomRules([]);
  };

  const addCustomRule = () => {
    nextRuleId.current += 1;
    setCustomRules((rules) => [
      ...rules,
      { id: nextRuleId.current, field: "change", operator: "gt", value: "" },
    ]);
  };

  const updateCustomRule = (id: number, update: Partial<CustomRule>) => {
    setCustomRules((rules) => rules.map((rule) => rule.id === id ? { ...rule, ...update } : rule));
  };

  const removeCustomRule = (id: number) => {
    setCustomRules((rules) => rules.filter((rule) => rule.id !== id));
  };

  const downloadCsv = () => {
    const headers = ["Alert", "ASIN", "Product", "Catalog category", "Current", "Previous", "Change", "Stock", "Detected at"];
    const rows = filtered.map((row) => [
      TYPE_META[row.alert_type].label,
      row.asin,
      row.product_name,
      row.category,
      metricValue(row, isAvailability(row) ? (row.in_stock ? 1 : 0) : row.current_value),
      metricValue(row, row.previous_value),
      changeValue(row),
      row.in_stock === null ? "No data" : row.in_stock ? "In Stock" : "Out of Stock",
      formatDateTime(row.detected_at),
    ]);
    const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = Boolean(
    q || alertType || catalogCategory || interval !== "latest" || customRules.length
  );
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-[var(--text)]">
            <BellRing className="text-[var(--accent)]" size={24} /> Product Alerts
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Review, pricing, rating and availability signals from your Amazon snapshot history.
          </p>
        </div>
        <Button variant="outline" icon={<Download size={15} />} onClick={downloadCsv} disabled={!filtered.length}>
          Export current view
        </Button>
      </div>

      {isLoading ? (
        <Spinner label="Loading alerts…" />
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Out of Stock"
                value={summary.out_of_stock}
                sub="Current availability"
                icon={<PackageX size={18} />}
                accent="rgba(244,63,94,0.15)"
              />
              <KpiCard
                label="Available"
                value={summary.in_stock}
                sub="Current availability"
                icon={<PackageCheck size={18} />}
                accent="rgba(16,185,129,0.15)"
              />
              <KpiCard
                label="Negative Reviews"
                value={summary.negative_reviews_increased}
                sub="Counts increased"
                icon={<TrendingDown size={18} />}
                accent="rgba(244,63,94,0.15)"
              />
              <KpiCard
                label="Price Moves"
                value={summary.price_increased + summary.price_decreased}
                sub={`${summary.price_increased} up · ${summary.price_decreased} down`}
                icon={<TrendingUp size={18} />}
                accent="rgba(245,158,11,0.15)"
              />
              <KpiCard
                label="Rating Moves"
                value={summary.rating_increased + summary.rating_decreased}
                sub={`${summary.rating_increased} up · ${summary.rating_decreased} down`}
                icon={<BellRing size={18} />}
                accent="rgba(109,94,252,0.15)"
              />
            </div>
          )}

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Filter controls
              </span>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-medium text-[var(--accent)] hover:underline">
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={alertType} onChange={(event) => setAlertType(event.target.value as AlertFilter)}>
                {ALERT_TYPE_OPTIONS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </Select>
              <Select value={interval} onChange={(event) => setInterval(event.target.value as AlertInterval)}>
                {TIME_RANGE_OPTIONS.map((range) => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </Select>
              {interval === "custom" && (
                <>
                  <Input
                    type="date"
                    aria-label="Alerts from date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                  <Input
                    type="date"
                    aria-label="Alerts to date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </>
              )}
              <div className="relative min-w-[240px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  className="w-full pl-9"
                  placeholder="Search ASIN or product name..."
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <Select value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}>
                <option value="">All catalog categories</option>
                {catalogCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
              <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="detected_at">Sort: detected time</option>
                <option value="product">Sort: product</option>
                <option value="category">Sort: catalog category</option>
                <option value="alert">Sort: alert type</option>
                <option value="current">Sort: current value</option>
                <option value="previous">Sort: previous value</option>
                <option value="change">Sort: change</option>
              </Select>
              <button
                onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--panel)]"
                title={`Currently ${sortDirection === "asc" ? "ascending" : "descending"}; click to change`}
              >
                {sortDirection === "asc" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                {sortDirection === "asc" ? "Ascending" : "Descending"}
              </button>
            </div>
            {interval === "custom" && !rangeReady && (
              <p className="mt-3 text-xs text-amber-300">Select both dates to load the custom range.</p>
            )}

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Custom rules</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    Build your own conditions. Every rule must match.
                  </p>
                </div>
                <Button variant="outline" icon={<Plus size={14} />} onClick={addCustomRule}>
                  Add rule
                </Button>
              </div>
              {customRules.length > 0 && (
                <div className="mt-3 space-y-2">
                  {customRules.map((rule) => (
                    <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--panel-2)] p-2">
                      <Select
                        value={rule.field}
                        onChange={(event) => {
                          const field = event.target.value as CustomField;
                          updateCustomRule(rule.id, {
                            field,
                            operator: field === "stock" ? "eq" : rule.operator,
                            value: field === "stock" ? "in_stock" : rule.field === "stock" ? "" : rule.value,
                          });
                        }}
                      >
                        {RULE_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>{field.label}</option>
                        ))}
                      </Select>
                      <Select
                        value={rule.operator}
                        onChange={(event) => updateCustomRule(rule.id, { operator: event.target.value as CustomOperator })}
                      >
                        {(rule.field === "stock"
                          ? RULE_OPERATORS.filter((operator) => operator.value === "eq" || operator.value === "neq")
                          : RULE_OPERATORS
                        ).map((operator) => (
                          <option key={operator.value} value={operator.value}>{operator.label}</option>
                        ))}
                      </Select>
                      {rule.field === "stock" ? (
                        <Select value={rule.value} onChange={(event) => updateCustomRule(rule.id, { value: event.target.value })}>
                          <option value="in_stock">In stock</option>
                          <option value="out_of_stock">Out of stock</option>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          className="w-36"
                          placeholder="Value"
                          value={rule.value}
                          onChange={(event) => updateCustomRule(rule.id, { value: event.target.value })}
                        />
                      )}
                      <button
                        onClick={() => removeCustomRule(rule.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-rose-500/10 hover:text-rose-400"
                        title="Remove rule"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">Alert feed</h3>
              <span className="text-xs text-[var(--muted)]">Showing {filtered.length} of {data?.rows.length ?? 0} signals</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-5 py-3">Alert</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Catalog Category</th>
                    <th className="px-5 py-3 text-right">Current</th>
                    <th className="px-5 py-3 text-right">Previous</th>
                    <th className="px-5 py-3 text-right">Change</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <AlertTableRow key={`${row.asin}-${row.alert_type}-${row.detected_at}`} row={row} />
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-[var(--muted)]">
                        No signals match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function AlertTableRow({ row }: { row: AlertRow }) {
  const changeIsPositive = row.change !== null && row.change > 0;
  const current = isAvailability(row) ? (row.in_stock ? 1 : 0) : row.current_value;
  return (
    <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]">
      <td className="px-5 py-3"><Badge variant={TYPE_META[row.alert_type].variant}>{TYPE_META[row.alert_type].label}</Badge></td>
      <td className="px-5 py-3">
        <a href={row.amazon_url} target="_blank" rel="noreferrer" className="inline-flex max-w-[260px] items-center gap-1.5 font-semibold text-[var(--text)] hover:text-[var(--accent)]">
          <span className="truncate">{row.product_name}</span> <ExternalLink className="shrink-0" size={12} />
        </a>
        <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">{row.asin}</p>
      </td>
      <td className="px-5 py-3 text-[var(--muted)]">{row.category ?? "—"}</td>
      <td className="px-5 py-3 text-right font-medium text-[var(--text)]">{metricValue(row, current)}</td>
      <td className="px-5 py-3 text-right text-[var(--muted)]">{metricValue(row, row.previous_value)}</td>
      <td className={`px-5 py-3 text-right font-medium ${row.change === null ? "text-[var(--muted)]" : changeIsPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {changeValue(row)}
      </td>
      <td className="px-5 py-3">
        {row.in_stock === null ? <Badge variant="amber">No data</Badge> : <Badge variant={row.in_stock ? "green" : "red"}>{row.in_stock ? "In Stock" : "Out of Stock"}</Badge>}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-xs text-[var(--muted)]">{formatDateTime(row.detected_at)}</td>
    </tr>
  );
}
