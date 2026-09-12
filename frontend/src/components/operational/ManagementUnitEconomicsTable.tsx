import type {
  CategoryOperationalMetrics,
  OperationalDashboard,
  OperationalMetrics,
} from "../../api/types";
import { formatRoundedNumber as formatNumber } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .replace(" ", "-");
}

function percentage(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function spendPercentage(spend: number, poValue: number) {
  return poValue ? (spend / poValue) * 100 : null;
}

function varianceTone(value: number | null) {
  if (value === null || value === 0) return "text-[var(--text)]";
  return value > 0
    ? "bg-emerald-500/10 font-bold text-emerald-500"
    : "bg-rose-500/10 font-bold text-rose-500";
}

function NumberCell({
  value,
  className = "",
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <td
      className={`border-[3px] border-[var(--muted)] px-1.5 py-1.5 text-right tabular-nums ${className}`}
    >
      {formatNumber(value)}
    </td>
  );
}

function PercentageCell({
  value,
  digits,
  className = "",
}: {
  value: number | null;
  digits: number;
  className?: string;
}) {
  return (
    <td
      className={`border-[3px] border-[var(--muted)] px-1.5 py-1.5 text-right tabular-nums ${className}`}
    >
      {percentage(value, digits)}
    </td>
  );
}

function EconomicsRow({
  label,
  metrics,
  total = false,
}: {
  label: string;
  metrics: OperationalMetrics;
  total?: boolean;
}) {
  const targetSpendPct = spendPercentage(metrics.planned_spend, metrics.planned_po_value);
  const achievedSpendPct = spendPercentage(metrics.actual_spend, metrics.actual_po_value);
  const spendPctDifference =
    targetSpendPct !== null && achievedSpendPct !== null
      ? targetSpendPct - achievedSpendPct
      : null;
  // Match the management workbook: express the utilization gap on the target PO base.
  const spendAmountDifference =
    spendPctDifference === null ? null : (spendPctDifference / 100) * metrics.planned_po_value;
  const poValueDifference = metrics.actual_po_value - metrics.planned_po_value;
  const rowClass = total ? "bg-violet-500/10 font-bold" : "even:bg-[var(--panel-2)]/45";

  return (
    <tr className={rowClass}>
      <th
        scope="row"
        className="border-[3px] border-[var(--muted)] px-2 py-1.5 text-left font-medium text-[var(--text)]"
        title={label}
      >
        <span className="block truncate">{label}</span>
      </th>

      <NumberCell value={metrics.planned_units} className="text-[var(--text)]" />
      <NumberCell value={metrics.planned_spend} className="text-[var(--text)]" />
      <NumberCell value={metrics.planned_po_value} className="text-[var(--text)]" />
      <PercentageCell
        value={targetSpendPct}
        digits={2}
        className="bg-amber-400/[0.06] text-[var(--text)]"
      />

      <td aria-hidden className="w-3 border-0 bg-[var(--bg)] p-0" />

      <NumberCell
        value={metrics.actual_units}
        className="bg-emerald-500/10 font-semibold text-[var(--text)]"
      />
      <NumberCell
        value={metrics.actual_spend}
        className="bg-emerald-500/10 font-semibold text-[var(--text)]"
      />
      <NumberCell
        value={metrics.actual_po_value}
        className="bg-emerald-500/10 font-semibold text-[var(--text)]"
      />
      <PercentageCell
        value={achievedSpendPct}
        digits={2}
        className="bg-emerald-500/10 text-[var(--text)]"
      />

      <td aria-hidden className="w-3 border-0 bg-[var(--bg)] p-0" />

      <PercentageCell
        value={spendPctDifference}
        digits={1}
        className={varianceTone(spendPctDifference)}
      />
      <NumberCell
        value={spendAmountDifference}
        className={varianceTone(spendAmountDifference)}
      />
      <NumberCell value={poValueDifference} className={varianceTone(poValueDifference)} />
    </tr>
  );
}

export function ManagementUnitEconomicsTable({
  dashboard,
}: {
  dashboard: OperationalDashboard;
}) {
  const categories: CategoryOperationalMetrics[] = [...dashboard.categories].sort((left, right) =>
    left.category.localeCompare(right.category)
  );
  const periodLabel = `${shortDate(dashboard.date_from)} to ${shortDate(dashboard.date_to)}`;

  return (
    <Card className="overflow-hidden border-[3px] border-[var(--muted)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-[var(--muted)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            MTD Unit Economics Snapshot
          </h3>
          <p className="text-[11px] text-[var(--muted)]">
            Target versus achieved efficiency through the latest uploaded actual date
          </p>
        </div>
        <Badge variant="violet">Through {shortDate(dashboard.date_to)}</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] table-fixed border-collapse border-[3px] border-[var(--muted)] text-[10px] leading-tight">
          <colgroup>
            <col className="w-[12%]" />
            <col />
            <col />
            <col />
            <col />
            <col className="w-3" />
            <col />
            <col />
            <col />
            <col />
            <col className="w-3" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={3}
                className="border-[3px] border-[var(--muted)] bg-[var(--panel-2)] px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--text)]"
              >
                Category
              </th>
              <th
                colSpan={4}
                className="border-[3px] border-amber-400/80 bg-amber-400/20 px-2 py-1.5 text-center text-xs font-bold text-[var(--text)]"
                title="Paced target orders, spend, PO value, and spend allocation for the month to date"
              >
                Target
              </th>
              <th aria-hidden rowSpan={3} className="w-3 border-0 bg-[var(--bg)] p-0" />
              <th
                colSpan={4}
                className="border-[3px] border-emerald-500/80 bg-emerald-500/15 px-2 py-1.5 text-center text-xs font-bold text-[var(--text)]"
                title="Uploaded actual orders, spend, PO value, and spend utilization for the month to date"
              >
                Achieved
              </th>
              <th aria-hidden rowSpan={3} className="w-3 border-0 bg-[var(--bg)] p-0" />
              <th
                colSpan={3}
                className="border-[3px] border-violet-500/80 bg-violet-500/15 px-2 py-1.5 text-center text-xs font-bold text-[var(--text)]"
                title="Target minus achieved for spend percentage and amount; actual minus target for PO value"
              >
                Variance
              </th>
            </tr>
            <tr>
              <th
                colSpan={4}
                className="border-[3px] border-amber-400/80 bg-amber-400/10 px-2 py-1.5 text-center font-semibold text-[var(--text)]"
              >
                {dashboard.covered_days} days
              </th>
              <th
                colSpan={4}
                className="border-[3px] border-emerald-500/80 bg-emerald-500/10 px-2 py-1.5 text-center font-semibold text-[var(--text)]"
              >
                {periodLabel}
              </th>
              <th
                colSpan={3}
                className="border-[3px] border-violet-500/80 bg-violet-500/10 px-2 py-1.5 text-center font-semibold text-[var(--text)]"
              >
                Unit Economics
              </th>
            </tr>
            <tr className="uppercase tracking-wide text-[var(--text)]">
              <th className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2">DRR</th>
              <th className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2">
                Ads + COGS + OPA
              </th>
              <th className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2">
                PO Value
              </th>
              <th className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2">
                % of Spend Allocated
              </th>

              <th className="border-[3px] border-emerald-500/80 bg-emerald-500/10 px-1 py-2">
                DRR
              </th>
              <th className="border-[3px] border-emerald-500/80 bg-emerald-500/10 px-1 py-2">
                Ads + COGS + OPA
              </th>
              <th className="border-[3px] border-emerald-500/80 bg-emerald-500/10 px-1 py-2">
                PO Value
              </th>
              <th className="border-[3px] border-emerald-500/80 bg-emerald-500/10 px-1 py-2">
                % of Spend Utilized
              </th>

              <th className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2">
                Diff in % Spend
              </th>
              <th className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2">
                Diff Spend in AMT
              </th>
              <th className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2">
                Diff in PO Value
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <EconomicsRow
                key={category.category}
                label={category.category}
                metrics={category}
              />
            ))}
          </tbody>
          <tfoot>
            <EconomicsRow label="Grand Total" metrics={dashboard.summary} total />
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
