import { Fragment } from "react";
import type {
  CategoryOperationalMetrics,
  OperationalDashboard,
  OperationalTimelinePoint,
} from "../../api/types";
import { formatRoundedNumber as formatNumber } from "../../lib/utils";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`)
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .replace(" ", "-");
}

function pointFor(timeline: OperationalTimelinePoint[], reportDate: string) {
  return timeline.find((point) => point.date === reportDate);
}

function dailyAverage(
  timeline: OperationalTimelinePoint[],
  dates: string[],
  field: "expected_units" | "planned_spend" | "planned_po_value"
) {
  if (!dates.length) return 0;
  return (
    dates.reduce((total, reportDate) => total + (pointFor(timeline, reportDate)?.[field] ?? 0), 0) /
    dates.length
  );
}

function ValueCell({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <td
      className={`border-[3px] border-[var(--muted)] px-1.5 py-1.5 text-right tabular-nums text-[var(--text)] ${
        strong ? "font-bold" : "font-medium"
      }`}
    >
      {formatNumber(value)}
    </td>
  );
}

function TrendRow({
  label,
  timeline,
  dates,
  total = false,
}: {
  label: string;
  timeline: OperationalTimelinePoint[];
  dates: string[];
  total?: boolean;
}) {
  return (
    <tr className={total ? "bg-violet-500/10" : "even:bg-[var(--panel-2)]/45"}>
      <th
        scope="row"
        className={`border-[3px] border-[var(--muted)] px-2 py-1.5 text-left text-[var(--text)] ${
          total ? "font-bold" : "font-medium"
        }`}
        title={label}
      >
        <span className="block truncate">{label}</span>
      </th>
      <ValueCell value={dailyAverage(timeline, dates, "expected_units")} strong={total} />
      <ValueCell value={dailyAverage(timeline, dates, "planned_spend")} strong={total} />
      <ValueCell value={dailyAverage(timeline, dates, "planned_po_value")} strong={total} />
      {dates.map((reportDate) => {
        const point = pointFor(timeline, reportDate);
        return (
          <Fragment key={reportDate}>
            <td aria-hidden className="w-3 border-0 bg-[var(--bg)] p-0" />
            <ValueCell value={point?.actual_units ?? 0} strong={total} />
            <ValueCell
              value={point?.actual_ccogs_ads ?? 0}
              strong={total}
            />
            <ValueCell
              value={point?.actual_po_value ?? 0}
              strong={total}
            />
          </Fragment>
        );
      })}
    </tr>
  );
}

export function ManagementTrendTable({
  dashboard,
  dates,
}: {
  dashboard: OperationalDashboard;
  dates: string[];
}) {
  const categories: CategoryOperationalMetrics[] = [...dashboard.categories].sort((left, right) =>
    left.category.localeCompare(right.category)
  );

  return (
    <Card className="overflow-hidden border-[3px] border-[var(--muted)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-[var(--muted)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">3-Day Management Snapshot</h3>
          <p className="text-[11px] text-[var(--muted)]">
            Category-level daily targets and the latest uploaded actuals
          </p>
        </div>
        <Badge variant="violet">Screenshot ready</Badge>
      </div>

      {dates.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-fixed border-collapse border-[3px] border-[var(--muted)] text-[11px] leading-tight">
            <colgroup>
              <col className="w-[13%]" />
              {Array.from({ length: 3 }, (_, index) => (
                <col key={index} />
              ))}
              {dates.map((reportDate) => (
                <Fragment key={reportDate}>
                  <col className="w-3" />
                  <col />
                  <col />
                  <col />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="border-[3px] border-[var(--muted)] bg-[var(--panel-2)] px-2 py-2 text-left font-bold uppercase tracking-wide text-[var(--text)]"
                >
                  Category
                </th>
                <th
                  colSpan={3}
                  className="border-[3px] border-violet-500/80 bg-violet-500/15 px-2 py-2 text-center text-xs font-bold text-[var(--text)]"
                  title="Average daily order, spend, and PO-value targets across the displayed dates"
                >
                  Daily Target
                </th>
                {dates.map((reportDate) => (
                  <Fragment key={reportDate}>
                    <th
                      aria-hidden
                      rowSpan={2}
                      className="w-3 border-0 bg-[var(--bg)] p-0"
                    />
                    <th
                      colSpan={3}
                      className="border-[3px] border-amber-400/80 bg-amber-400/15 px-2 py-2 text-center text-xs font-bold text-[var(--text)]"
                    >
                      {dateLabel(reportDate)}
                    </th>
                  </Fragment>
                ))}
              </tr>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--text)]">
                <th
                  className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2"
                  title="Daily Run Rate: target orders per day"
                >
                  DRR
                </th>
                <th
                  className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2"
                  title="Average target spend per day"
                >
                  Budget / Day
                </th>
                <th
                  className="border-[3px] border-violet-500/80 bg-violet-500/10 px-1 py-2"
                  title="Average target PO value per day"
                >
                  PO Value
                </th>
                {dates.map((reportDate) => (
                  <Fragment key={reportDate}>
                    <th
                      className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2"
                      title="Actual orders uploaded for this date"
                    >
                      DRR
                    </th>
                    <th
                      className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2"
                      title="Actual ADS+Cogs spend uploaded for this date"
                    >
                      CCOGS + Ads
                    </th>
                    <th
                      className="border-[3px] border-amber-400/80 bg-amber-400/10 px-1 py-2"
                      title="Actual orders multiplied by PO Price for this date"
                    >
                      PO Value
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <TrendRow
                  key={category.category}
                  label={category.category}
                  timeline={category.timeline}
                  dates={dates}
                />
              ))}
            </tbody>
            <tfoot>
              <TrendRow label="Grand Total" timeline={dashboard.timeline} dates={dates} total />
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
          Upload daily actuals to create the management snapshot.
        </p>
      )}
    </Card>
  );
}
