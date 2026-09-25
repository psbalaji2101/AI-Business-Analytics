import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Lightbulb,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationalDashboard, OperationalMetrics, OperationalTimelinePoint } from "../../api/types";
import {
  formatINR as formatPreciseINR,
  formatRoundedINR as formatINR,
  formatRoundedNumber as formatNumber,
} from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Select } from "../ui/Spinner";

const COLORS = {
  units: "#6d5efc",
  po: "#10b981",
  spend: "#f59e0b",
  danger: "#f43f5e",
  track: "#303646",
  target: "#8b90a0",
};

const COMPONENTS = [
  { key: "ccogs_ads", label: "CCOGS + Ads", color: "#38bdf8" },
  { key: "reviews", label: "Review", color: "#ec4899" },
] as const;

type ScopedMetrics = OperationalMetrics & { timeline: OperationalTimelinePoint[] };

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function signedINR(value: number) {
  if (value === 0) return formatINR(0);
  return `${value > 0 ? "+" : "−"}${formatINR(Math.abs(value))}`;
}

function ringData(actual: number, target: number, color: string, overspent = false) {
  if (target <= 0) {
    return [
      {
        name: actual > 0 ? "Actual" : "No target",
        value: actual > 0 ? actual : 1,
        color: actual > 0 ? color : COLORS.track,
      },
    ];
  }
  if (actual >= target) {
    return [{ name: "Actual", value: actual, color: overspent ? COLORS.danger : color }];
  }
  const achieved = Math.min(actual, target);
  const remaining = Math.max(target - actual, 0);
  return [
    { name: "Achieved", value: achieved, color: overspent ? COLORS.danger : color },
    { name: "Remaining", value: remaining, color: COLORS.track },
  ];
}

function metricTone(value: number, favorableWhenPositive: boolean) {
  const favorable = favorableWhenPositive ? value >= 0 : value <= 0;
  return favorable ? "text-emerald-400" : "text-rose-400";
}

function DonutLegend({
  color,
  label,
  expected,
  actual,
  difference,
  percentage,
  money = false,
  favorableWhenPositive = true,
  extra,
}: {
  color: string;
  label: string;
  expected: number;
  actual: number;
  difference: number;
  percentage: number | null;
  money?: boolean;
  favorableWhenPositive?: boolean;
  extra?: string;
}) {
  const format = money ? formatINR : formatNumber;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="text-sm font-bold text-[var(--text)]">{pct(percentage)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[var(--muted)]">Target</p>
          <p className="font-semibold text-[var(--text)]">{format(expected)}</p>
        </div>
        <div>
          <p className="text-[var(--muted)]">Actual</p>
          <p className="font-semibold text-[var(--text)]">{format(actual)}</p>
        </div>
      </div>
      <p className={`mt-2 text-xs font-semibold ${metricTone(difference, favorableWhenPositive)}`}>
        Difference: {money ? signedINR(difference) : `${difference > 0 ? "+" : ""}${formatNumber(difference)}`}
      </p>
      {extra && <p className="mt-1 text-[10px] text-[var(--muted)]">{extra}</p>}
    </div>
  );
}

function BulletMeter({
  label,
  expected,
  adjusted,
  actual,
  color,
  money = false,
  favorableHigh = true,
  tolerancePct,
}: {
  label: string;
  expected: number;
  adjusted?: number;
  actual: number;
  color: string;
  money?: boolean;
  favorableHigh?: boolean;
  tolerancePct: number;
}) {
  const comparison = adjusted ?? expected;
  const limit = favorableHigh ? comparison : comparison * (1 + tolerancePct / 100);
  const unfavorable = favorableHigh ? actual < comparison * 0.95 : actual > limit;
  const fill = unfavorable ? COLORS.danger : color;
  const scale = Math.max(expected, comparison, actual, 1) * 1.12;
  const actualWidth = Math.min(100, (actual / scale) * 100);
  const expectedLeft = Math.min(100, (expected / scale) * 100);
  const adjustedLeft = Math.min(100, (comparison / scale) * 100);
  const format = money ? formatINR : formatNumber;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
        <span className="text-[11px] text-[var(--muted)]">
          Actual <strong className={unfavorable ? "text-rose-400" : "text-[var(--text)]"}>{format(actual)}</strong>
          {" · "}Target <strong className="text-[var(--text)]">{format(comparison)}</strong>
        </span>
      </div>
      <div className="relative mt-3 h-4 overflow-visible rounded-full bg-[var(--border)]">
        <div
          className="h-4 rounded-full transition-all duration-500"
          style={{ width: `${actualWidth}%`, backgroundColor: fill }}
        />
        <span
          className="absolute top-[-4px] h-6 w-0.5 bg-slate-300"
          style={{ left: `${expectedLeft}%` }}
          title={`Monthly target: ${format(expected)}`}
        />
        {adjusted !== undefined && Math.abs(adjusted - expected) > 0.01 && (
          <span
            className="absolute top-[-4px] h-6 w-0.5 bg-emerald-400"
            style={{ left: `${adjustedLeft}%` }}
            title={`Volume-adjusted target: ${format(adjusted)}`}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
        <span>0</span>
        <span>
          Gray marker: target
          {adjusted !== undefined && Math.abs(adjusted - expected) > 0.01
            ? " · Green marker: unit-adjusted"
            : ""}
        </span>
      </div>
    </div>
  );
}

function recommendation(
  label: string,
  actual: number,
  adjusted: number,
  achievement: number | null,
  tolerancePct: number
) {
  const tolerance = 1 + tolerancePct / 100;
  if (actual > adjusted * tolerance && actual > 0) {
    return {
      variant: "red" as const,
      icon: <AlertTriangle size={14} />,
      title: `Control ${label} spend`,
      detail: `${formatINR(actual - adjusted)} above its volume-adjusted budget. Review or cut this spend.`,
    };
  }
  const headroom = adjusted - actual;
  if (adjusted > 0 && actual < adjusted * 0.75) {
    if ((achievement ?? 0) >= 100) {
      return {
        variant: "green" as const,
        icon: <CheckCircle2 size={14} />,
        title: `${label} budget can be reallocated`,
        detail: `${formatINR(headroom)} headroom while units are at or above target.`,
      };
    }
    return {
      variant: "amber" as const,
      icon: <Lightbulb size={14} />,
      title: `Keep ${label} under review`,
      detail: `${formatINR(headroom)} headroom, but units are behind plan—check effectiveness before cutting.`,
    };
  }
  return {
    variant: "green" as const,
    icon: <CheckCircle2 size={14} />,
    title: `${label} is on track`,
    detail: `${signedINR(actual - adjusted)} versus its volume-adjusted budget.`,
  };
}

export function OperationalPerformanceVisuals({ dashboard }: { dashboard: OperationalDashboard }) {
  const [categoryName, setCategoryName] = useState("");
  const [productKey, setProductKey] = useState("");

  const products = useMemo(
    () =>
      dashboard.categories.flatMap((category) =>
        category.asins.map((asin) => ({
          ...asin,
          key: `${category.category}::${asin.asin}`,
        }))
      ),
    [dashboard.categories]
  );

  const visibleProducts = categoryName
    ? products.filter((product) => product.category === categoryName)
    : products;
  const selectedProduct = products.find((product) => product.key === productKey);
  const selectedCategory = dashboard.categories.find(
    (category) => category.category === categoryName
  );
  const scope: ScopedMetrics = selectedProduct
    ? selectedProduct
    : selectedCategory
      ? selectedCategory
      : { ...dashboard.summary, timeline: dashboard.timeline };
  const scopeLabel = selectedProduct
    ? `${selectedProduct.short_name} · ${selectedProduct.asin}`
    : selectedCategory?.category ?? "All Categories";

  const spendTarget = scope.volume_adjusted_budget;
  const spendOverspent = scope.actual_spend > spendTarget;
  const unitData = ringData(scope.actual_units, scope.planned_units, COLORS.units);
  const poData = ringData(scope.actual_po_value, scope.planned_po_value, COLORS.po);
  const spendData = ringData(scope.actual_spend, spendTarget, COLORS.spend, spendOverspent);
  const spendPct = spendTarget ? (scope.actual_spend / spendTarget) * 100 : null;

  const dailyData = scope.timeline.map((point, index) => ({
    ...point,
    day: point.date.slice(5),
    // Older API responses only include the cumulative adjusted budget.
    adjusted_budget: point.adjusted_budget ?? Number((
      point.cumulative_adjusted_budget -
      (scope.timeline[index - 1]?.cumulative_adjusted_budget ?? 0)
    ).toFixed(2)),
  }));
  const recommendations = COMPONENTS.map((component) => {
    const values = scope.spend_breakdown[component.key];
    return {
      ...component,
      values,
      recommendation: recommendation(
        component.label,
        values.actual,
        values.adjusted_budget,
        scope.unit_achievement_pct,
        dashboard.tolerance_pct
      ),
    };
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-2">
            <p className="text-sm font-semibold text-[var(--text)]">Visual analysis scope</p>
            <p className="text-xs text-[var(--muted)]">Switch from category to individual product</p>
          </div>
          <Select
            value={categoryName}
            onChange={(event) => {
              setCategoryName(event.target.value);
              setProductKey("");
            }}
          >
            <option value="">All Categories</option>
            {dashboard.categories.map((category) => (
              <option key={category.category} value={category.category}>
                {category.category}
              </option>
            ))}
          </Select>
          <Select
            value={productKey}
            onChange={(event) => {
              const value = event.target.value;
              setProductKey(value);
              const product = products.find((item) => item.key === value);
              if (product) setCategoryName(product.category);
            }}
          >
            <option value="">All products in scope</option>
            {visibleProducts.map((product) => (
              <option key={product.key} value={product.key}>
                {product.short_name} — {product.asin}
              </option>
            ))}
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant="gray">Target CAC: {formatPreciseINR(scope.target_cac)}</Badge>
            <Badge variant="violet">Actual CAC: {formatPreciseINR(scope.cac)}</Badge>
            <Badge variant={spendOverspent ? "red" : "green"}>
              {spendOverspent ? "Over-Spent" : "Under-Spent"}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Nested Performance Donut</h3>
              <p className="text-xs text-[var(--muted)]">{scopeLabel}</p>
            </div>
            <Badge variant={scope.status === "overspend" ? "red" : scope.status === "healthy" ? "green" : "amber"}>
              {scope.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="mt-3 grid items-center gap-4 md:grid-cols-[minmax(260px,0.9fr)_1.1fr]">
            <div className="relative h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={unitData} dataKey="value" innerRadius={112} outerRadius={137} startAngle={90} endAngle={-270} stroke="none">
                    {unitData.map((entry) => <Cell key={`units-${entry.name}`} fill={entry.color} />)}
                  </Pie>
                  <Pie data={poData} dataKey="value" innerRadius={80} outerRadius={104} startAngle={90} endAngle={-270} stroke="none">
                    {poData.map((entry) => <Cell key={`po-${entry.name}`} fill={entry.color} />)}
                  </Pie>
                  <Pie data={spendData} dataKey="value" innerRadius={48} outerRadius={72} startAngle={90} endAngle={-270} stroke="none">
                    {spendData.map((entry) => <Cell key={`spend-${entry.name}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value))}
                    contentStyle={{
                      backgroundColor: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="max-w-[94px] text-center">
                  <Gauge className="mx-auto text-[var(--accent)]" size={20} />
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">Actual spend</p>
                  <p className="text-sm font-bold text-[var(--text)]">{formatINR(scope.actual_spend)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <DonutLegend
                color={COLORS.units}
                label="Outer · Units / DRR"
                expected={scope.planned_units}
                actual={scope.actual_units}
                difference={scope.unit_variance}
                percentage={scope.unit_achievement_pct}
              />
              <DonutLegend
                color={COLORS.po}
                label="Middle · PO Value"
                expected={scope.planned_po_value}
                actual={scope.actual_po_value}
                difference={scope.po_value_variance}
                percentage={scope.planned_po_value ? (scope.actual_po_value / scope.planned_po_value) * 100 : null}
                money
              />
              <DonutLegend
                color={spendOverspent ? COLORS.danger : COLORS.spend}
                label="Inner · Spend"
                expected={spendTarget}
                actual={scope.actual_spend}
                difference={scope.adjusted_spend_variance}
                percentage={spendPct}
                money
                favorableWhenPositive={false}
                extra={`Target budget: ${formatINR(scope.planned_spend)} · Volume-adjusted: ${formatINR(spendTarget)}`}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Progress / Bullet Graphs</h3>
            <p className="text-xs text-[var(--muted)]">
              Filled bar = actual · markers show target and volume-adjusted limits
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <BulletMeter
              label="Units achieved"
              expected={scope.planned_units}
              actual={scope.actual_units}
              color={COLORS.units}
              tolerancePct={dashboard.tolerance_pct}
            />
            <BulletMeter
              label="PO value achieved"
              expected={scope.planned_po_value}
              actual={scope.actual_po_value}
              color={COLORS.po}
              money
              tolerancePct={dashboard.tolerance_pct}
            />
            <BulletMeter
              label="Total spend"
              expected={scope.planned_spend}
              adjusted={scope.volume_adjusted_budget}
              actual={scope.actual_spend}
              color={COLORS.spend}
              money
              favorableHigh={false}
              tolerancePct={dashboard.tolerance_pct}
            />
            {recommendations.map((item) => (
              <BulletMeter
                key={item.key}
                label={`${item.label} spend`}
                expected={item.values.planned}
                adjusted={item.values.adjusted_budget}
                actual={item.values.actual}
                color={item.color}
                money
                favorableHigh={false}
                tolerancePct={dashboard.tolerance_pct}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Target DRR vs Actual DRR · Daily</h3>
            <p className="text-xs text-[var(--muted)]">{scopeLabel} · bars show each day; lines show cumulative units</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="gray">Target</Badge>
            <Badge variant="violet">Actual</Badge>
          </div>
        </div>
        {dailyData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={dailyData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} />
              <YAxis
                yAxisId="daily"
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                width={55}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="right"
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                width={55}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => formatNumber(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                }}
              />
              <Legend />
              <Bar yAxisId="daily" dataKey="expected_units" name="Target DRR" fill={COLORS.target} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="daily" dataKey="actual_units" name="Actual DRR" fill={COLORS.units} radius={[3, 3, 0, 0]} />
              <Line yAxisId="cumulative" type="monotone" dataKey="cumulative_expected_units" name="Cumulative target" stroke="#cbd5e1" strokeDasharray="5 4" dot={false} />
              <Line yAxisId="cumulative" type="monotone" dataKey="cumulative_actual_units" name="Cumulative actual" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--muted)]">No daily data for this scope.</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text)]">Total Spend · Daily</h3>
        <p className="text-xs text-[var(--muted)]">
          {scopeLabel} · expected, unit-adjusted, and actual spend for each day
        </p>
        {dailyData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dailyData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} stroke="var(--muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                width={90}
                tickFormatter={(value: number) => formatINR(value)}
              />
              <Tooltip
                formatter={(value) => formatPreciseINR(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                }}
              />
              <Legend />
              <Line type="linear" dataKey="planned_spend" name="Expected spend" stroke={COLORS.target} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="actual_spend" name="Actual spend" stroke={COLORS.spend} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="linear" dataKey="adjusted_budget" name="Unit-adjusted spend" stroke={COLORS.po} strokeWidth={3} strokeDasharray="6 4" dot={{ r: 5, fill: "none", strokeWidth: 2 }} activeDot={{ r: 7, fill: "none", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--muted)]">No daily data for this scope.</p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text)]">PO Value · Daily</h3>
        <p className="text-xs text-[var(--muted)]">
          {scopeLabel} · achieved PO value against each day's target · missing actual rows count as zero
        </p>
        {dailyData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={dailyData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} stroke="var(--muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--muted)"
                fontSize={11}
                tickLine={false}
                width={90}
                tickFormatter={(value: number) => formatINR(value)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as OperationalTimelinePoint | undefined;
                  if (!active || !point) return null;
                  const difference = point.actual_po_value - point.planned_po_value;
                  const achievement = point.planned_po_value > 0
                    ? `${((point.actual_po_value / point.planned_po_value) * 100).toFixed(1)}% of target`
                    : "No target";
                  return (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-xs text-[var(--text)] shadow-lg">
                      <p className="mb-2 font-semibold">{point.date}</p>
                      <p>Achieved PO value: {formatPreciseINR(point.actual_po_value)}</p>
                      <p>Target PO value: {formatPreciseINR(point.planned_po_value)}</p>
                      <p className="mt-2 font-semibold">{achievement}</p>
                      {point.planned_po_value > 0 && (
                        <p className={metricTone(difference, true)}>
                          {formatPreciseINR(Math.abs(difference))} {difference > 0 ? "above target" : difference < 0 ? "below target" : "· target met"}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="actual_po_value" name="Achieved PO value" fill={COLORS.po} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Line type="linear" dataKey="planned_po_value" name="Target PO value" stroke={COLORS.target} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--muted)]">No daily data for this scope.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <CircleDollarSign size={18} className="text-[var(--accent)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Budget Action Signals</h3>
            <p className="text-xs text-[var(--muted)]">
              Recommendations compare actual component spend with its unit-adjusted allowance.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendations.map((item) => (
            <div key={item.key} className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3">
              <Badge variant={item.recommendation.variant}>
                {item.recommendation.icon} {item.recommendation.title}
              </Badge>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.recommendation.detail}</p>
              <p className="mt-2 text-[11px] text-[var(--text)]">
                Actual {formatINR(item.values.actual)} · Allowed {formatINR(item.values.adjusted_budget)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
