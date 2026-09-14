import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type {
  CategoryOperationalMetrics,
  OperationalDashboard,
} from "../../api/types";
import {
  formatINR as formatPreciseINR,
  formatRoundedINR as formatINR,
  formatRoundedNumber as formatNumber,
} from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { InfoTooltip } from "../ui/InfoTooltip";
import { Input, Select } from "../ui/Spinner";

type SpendView = "overspent" | "underspent" | "custom";
type CustomStatus = "all" | "overspent" | "underspent";

const viewOptions: Array<{
  value: SpendView;
  label: string;
  icon: typeof AlertTriangle;
}> = [
  { value: "overspent", label: "Over-Spent", icon: AlertTriangle },
  { value: "underspent", label: "Under-Spent", icon: CheckCircle2 },
  { value: "custom", label: "Custom filter", icon: SlidersHorizontal },
];

function SpendStatus({ variance }: { variance: number }) {
  return variance > 0 ? (
    <Badge variant="red">Over-Spent</Badge>
  ) : (
    <Badge variant="green">Under-Spent</Badge>
  );
}

function varianceClass(value: number) {
  if (value > 0) return "text-rose-400";
  if (value < 0) return "text-emerald-400";
  return "text-[var(--muted)]";
}

function matchesSearch(category: CategoryOperationalMetrics, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;

  return (
    category.category.toLocaleLowerCase().includes(normalized) ||
    category.asins.some(
      (asin) =>
        asin.asin.toLocaleLowerCase().includes(normalized) ||
        asin.short_name.toLocaleLowerCase().includes(normalized)
    )
  );
}

export function CategorySpendControl({ dashboard }: { dashboard: OperationalDashboard }) {
  const [view, setView] = useState<SpendView>("overspent");
  const [query, setQuery] = useState("");
  const [customStatus, setCustomStatus] = useState<CustomStatus>("all");
  const [minimumVariance, setMinimumVariance] = useState("");
  const [maximumVariance, setMaximumVariance] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const overspentCount = dashboard.categories.filter(
    (category) => category.adjusted_spend_variance > 0
  ).length;
  const underspentCount = dashboard.categories.filter(
    (category) => category.adjusted_spend_variance <= 0
  ).length;

  const filteredCategories = useMemo(() => {
    const categories = dashboard.categories.filter((category) => {
      if (view === "overspent") return category.adjusted_spend_variance > 0;
      if (view === "underspent") return category.adjusted_spend_variance <= 0;
      if (!matchesSearch(category, query)) return false;
      if (customStatus === "overspent" && category.adjusted_spend_variance <= 0) return false;
      if (customStatus === "underspent" && category.adjusted_spend_variance > 0) return false;

      const minimum = minimumVariance.trim() === "" ? null : Number(minimumVariance);
      const maximum = maximumVariance.trim() === "" ? null : Number(maximumVariance);
      if (minimum !== null && Number.isFinite(minimum)) {
        if (category.adjusted_spend_variance < minimum) return false;
      }
      if (maximum !== null && Number.isFinite(maximum)) {
        if (category.adjusted_spend_variance > maximum) return false;
      }
      return true;
    });

    return [...categories].sort((left, right) => {
      if (view === "overspent") {
        return right.adjusted_spend_variance - left.adjusted_spend_variance;
      }
      if (view === "underspent") {
        return left.adjusted_spend_variance - right.adjusted_spend_variance;
      }
      return left.category.localeCompare(right.category);
    });
  }, [customStatus, dashboard.categories, maximumVariance, minimumVariance, query, view]);

  const selected = dashboard.categories.find(
    (category) => category.category === selectedCategory
  );
  const selectedIsVisible = filteredCategories.some(
    (category) => category.category === selectedCategory
  );
  const visibleSelection = selectedIsVisible ? selected : undefined;
  const tabCount = (value: SpendView) => {
    if (value === "overspent") return overspentCount;
    if (value === "underspent") return underspentCount;
    return dashboard.categories.length;
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative z-20 bg-[var(--panel)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  Category Spend Control
                </h3>
                <InfoTooltip
                  label="category spend status rules"
                  contentClassName="w-96"
                  description={
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">Adjusted budget</span> is the planned cost
                        per order multiplied by actual orders. Actual spend is ADS+Cogs plus OPA
                        Payment. The budget is strict, with no tolerance applied.
                      </p>
                      <ul className="space-y-1">
                        <li>
                          <span className="font-semibold">Under-Spent:</span> actual spend is equal to
                          or below the unit-adjusted budget.
                        </li>
                        <li>
                          <span className="font-semibold">Over-Spent:</span> actual spend is above
                          the unit-adjusted budget.
                        </li>
                        <li>
                          <span className="font-semibold">No sales:</span> a target exists, but there
                          are no actual orders or spend.
                        </li>
                        <li>
                          <span className="font-semibold">No target:</span> no target orders exist
                          for the category.
                        </li>
                      </ul>
                    </div>
                  }
                />
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Find categories outside or within their volume-adjusted budget, then select one to
                inspect its products.
              </p>
            </div>
            <Badge variant="violet">
              {formatNumber(dashboard.categories.length)} categories
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Category spend filters">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const active = option.value === view;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setView(option.value)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-[var(--panel-2)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <Icon size={14} />
                  {option.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-[var(--panel)] text-[var(--muted)]"
                    }`}
                  >
                    {tabCount(option.value)}
                  </span>
                </button>
              );
            })}
          </div>

          {view === "custom" && (
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-[minmax(220px,1.5fr)_minmax(145px,1fr)_120px_120px]">
              <label className="relative block">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <span className="sr-only">Search categories, products, or ASINs</span>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Category, product, or ASIN"
                  className="w-full pl-9"
                />
              </label>
              <label>
                <span className="sr-only">Filter by spend status</span>
                <Select
                  value={customStatus}
                  onChange={(event) => setCustomStatus(event.target.value as CustomStatus)}
                  className="w-full"
                >
                  <option value="all">All statuses</option>
                  <option value="overspent">Over-Spent</option>
                  <option value="underspent">Under-Spent</option>
                </Select>
              </label>
              <label>
                <span className="sr-only">Minimum spend variance in rupees</span>
                <Input
                  type="number"
                  value={minimumVariance}
                  onChange={(event) => setMinimumVariance(event.target.value)}
                  placeholder="Min variance ₹"
                  className="w-full"
                />
              </label>
              <label>
                <span className="sr-only">Maximum spend variance in rupees</span>
                <Input
                  type="number"
                  value={maximumVariance}
                  onChange={(event) => setMaximumVariance(event.target.value)}
                  placeholder="Max variance ₹"
                  className="w-full"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="grid min-h-[520px] lg:h-[640px] lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.65fr)]">
        <div className="flex min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <span>Category</span>
            <span>Spend variance</span>
          </div>

          <div className="max-h-[520px] flex-1 overflow-y-scroll lg:max-h-none">
            {filteredCategories.length ? (
              filteredCategories.map((category) => {
                const active = visibleSelection?.category === category.category;
                return (
                  <button
                    key={category.category}
                    type="button"
                    aria-expanded={active}
                    onClick={() =>
                      setSelectedCategory(active ? null : category.category)
                    }
                    className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0 ${
                      active
                        ? "bg-[var(--accent)]/10"
                        : "hover:bg-[var(--panel-2)]/70"
                    }`}
                  >
                    <ChevronRight
                      size={16}
                      className={`shrink-0 text-[var(--muted)] transition-transform ${
                        active ? "rotate-90 text-[var(--accent)]" : ""
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {category.category}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                        <span>{formatNumber(category.asins.length)} products</span>
                        <SpendStatus variance={category.adjusted_spend_variance} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-sm font-semibold ${varianceClass(
                          category.adjusted_spend_variance
                        )}`}
                      >
                        {formatINR(category.adjusted_spend_variance)}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {formatINR(category.actual_spend)} spent
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-5 py-16 text-center">
                <p className="text-sm font-semibold text-[var(--text)]">No categories found</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {view === "overspent"
                    ? "No category is currently above its allowed spend."
                    : view === "underspent"
                      ? "No category is currently Under-Spent."
                      : "Try a different category, product, or ASIN search."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {visibleSelection ? (
            <>
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">
                      {visibleSelection.category}
                    </h4>
                    <SpendStatus variance={visibleSelection.adjusted_spend_variance} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatINR(visibleSelection.actual_spend)} actual spend vs{" "}
                    {formatINR(visibleSelection.volume_adjusted_budget)} adjusted budget
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-base font-bold ${varianceClass(
                      visibleSelection.adjusted_spend_variance
                    )}`}
                  >
                    {formatINR(visibleSelection.adjusted_spend_variance)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Spend variance
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--panel-2)] shadow-[0_1px_0_var(--border)]">
                    <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-4 py-3">Product / ASIN</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Actual spend</th>
                      <th className="px-4 py-3 text-right">Adjusted budget</th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3 text-right">Target CAC</th>
                      <th className="px-4 py-3 text-right">Actual CAC</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...visibleSelection.asins]
                      .sort(
                        (left, right) =>
                          right.adjusted_spend_variance - left.adjusted_spend_variance
                      )
                      .map((asin) => (
                        <tr
                          key={asin.asin}
                          className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--panel-2)]/60"
                        >
                          <td className="px-4 py-3">
                            <p className="max-w-[260px] truncate font-semibold text-[var(--text)]">
                              {asin.short_name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--muted)]">{asin.asin}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text)]">
                            {formatNumber(asin.actual_units)}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text)]">
                            {formatINR(asin.actual_spend)}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text)]">
                            {formatINR(asin.volume_adjusted_budget)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold ${varianceClass(
                              asin.adjusted_spend_variance
                            )}`}
                          >
                            {formatINR(asin.adjusted_spend_variance)}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text)]">
                            {formatPreciseINR(asin.target_cac)}
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text)]">
                            {formatPreciseINR(asin.cac)}
                          </td>
                          <td className="px-4 py-3">
                            <SpendStatus variance={asin.adjusted_spend_variance} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[520px] items-center justify-center px-6 py-14 text-center lg:min-h-0">
              <div className="max-w-sm">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <ChevronRight size={20} />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                  Select a category to view its products
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  Product-level orders, actual spend, adjusted budget, variance, target and actual
                  CAC, and status will appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
