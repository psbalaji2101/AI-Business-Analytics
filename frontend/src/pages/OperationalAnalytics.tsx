import { Fragment, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gauge,
  IndianRupee,
  PackageCheck,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useDeleteOperationalActual,
  useDeleteOperationalForecast,
  useOperationalActuals,
  useOperationalDashboard,
  useOperationalForecasts,
  useUploadOperationalActual,
  useUploadOperationalForecast,
  type OperationalFilters,
} from "../api/hooks";
import { api } from "../api/client";
import type { OperationalMetrics } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, KpiCard } from "../components/ui/Card";
import { Input, Spinner } from "../components/ui/Spinner";
import { errorMessage, useToast } from "../components/ui/Toast";
import { formatDate, formatINR, formatNumber } from "../lib/utils";
import { OperationalPerformanceVisuals } from "../components/operational/OperationalPerformanceVisuals";

const today = new Date().toISOString().slice(0, 10);

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function monthLabel(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function statusBadge(status: OperationalMetrics["status"]) {
  const config = {
    healthy: { label: "On track", variant: "green" as const },
    efficient_but_behind: { label: "Efficient · behind plan", variant: "amber" as const },
    overspend: { label: "Over unit cost", variant: "red" as const },
    no_sales: { label: "No sales", variant: "gray" as const },
    no_target: { label: "No target", variant: "gray" as const },
  }[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function filenameFromHeader(value: string | undefined, fallback: string) {
  const encoded = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  const plain = value?.match(/filename="?([^";]+)"?/i)?.[1];
  return plain || fallback;
}

async function downloadFile(path: string, fallback: string, params?: Record<string, string>) {
  const response = await api.get(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromHeader(response.headers["content-disposition"], fallback);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SpendDetail({ row }: { row: OperationalMetrics }) {
  const items = [
    ["CCOGS", row.spend_breakdown.ccogs],
    ["Ads", row.spend_breakdown.ads],
    ["Coupons", row.spend_breakdown.coupons],
    ["Reviews", row.spend_breakdown.reviews],
  ] as const;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
      {items.map(([label, value]) => (
        <span key={label} title="Actual / volume-adjusted budget">
          {label}: {formatINR(value.actual)} / {formatINR(value.adjusted_budget)}
        </span>
      ))}
    </div>
  );
}

export default function OperationalAnalytics() {
  const [filters, setFilters] = useState<OperationalFilters>({});
  const [forecastMonth, setForecastMonth] = useState(today.slice(0, 7));
  const [actualDate, setActualDate] = useState(today);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const forecastInput = useRef<HTMLInputElement>(null);
  const actualInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const dashboard = useOperationalDashboard(filters);
  const forecasts = useOperationalForecasts();
  const actuals = useOperationalActuals();
  const uploadForecast = useUploadOperationalForecast();
  const uploadActual = useUploadOperationalActual();
  const deleteForecast = useDeleteOperationalForecast();
  const deleteActual = useDeleteOperationalActual();

  const range = {
    date_from: filters.date_from ?? dashboard.data?.date_from ?? "",
    date_to: filters.date_to ?? dashboard.data?.date_to ?? "",
  };

  const onForecastFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadForecast.mutateAsync({ file, month: forecastMonth });
      toast.success(
        `${monthLabel(result.period)} forecast uploaded: ${formatNumber(result.row_count)} ASINs.`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (forecastInput.current) forecastInput.current.value = "";
    }
  };

  const onActualFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadActual.mutateAsync({ file, reportDate: actualDate });
      toast.success(
        `${formatDate(result.period)} actuals uploaded: ${formatNumber(result.row_count)} ASINs.`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (actualInput.current) actualInput.current.value = "";
    }
  };

  const handleDownload = async (path: string, fallback: string, params?: Record<string, string>) => {
    try {
      await downloadFile(path, fallback, params);
    } catch (error) {
      toast.error(errorMessage(error, "Download failed."));
    }
  };

  const removeForecast = async (id: number, label: string) => {
    if (!confirm(`Delete the ${label} forecast? Download the original first if you need a copy.`)) {
      return;
    }
    try {
      await deleteForecast.mutateAsync(id);
      toast.success("Forecast deleted. You can now upload its replacement.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeActual = async (id: number, label: string) => {
    if (!confirm(`Delete the daily actuals for ${label}?`)) return;
    try {
      await deleteActual.mutateAsync(id);
      toast.success("Daily actuals deleted. You can now upload a replacement for that date.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggleCategory = (category: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const summary = dashboard.data?.summary;
  const chartData = (dashboard.data?.timeline ?? []).map((point) => ({
    ...point,
    day: point.date.slice(5),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Operational Analytics</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Forecast versus actual performance, adjusted for the unit economics of every ASIN
          </p>
        </div>
        <Button
          variant="outline"
          icon={<Download size={15} />}
          disabled={!dashboard.data?.categories.length}
          onClick={() =>
            handleDownload("/operational/dashboard/export", "operational-analytics.csv", {
              ...(range.date_from ? { date_from: range.date_from } : {}),
              ...(range.date_to ? { date_to: range.date_to } : {}),
            })
          }
        >
          Export Dashboard CSV
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-500/15 p-2 text-violet-300">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)]">Monthly Forecast</h3>
              <p className="text-xs text-[var(--muted)]">
                Monthly PO value and component budgets with an already-rounded daily run rate
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={forecastMonth}
              onChange={(event) => setForecastMonth(event.target.value)}
            />
            <Button
              icon={<Upload size={15} />}
              disabled={!forecastMonth || uploadForecast.isPending}
              onClick={() => forecastInput.current?.click()}
            >
              {uploadForecast.isPending ? "Uploading…" : "Upload Forecast"}
            </Button>
            <Button
              variant="outline"
              icon={<Download size={14} />}
              onClick={() =>
                handleDownload(
                  "/operational/templates/forecast",
                  "operational-forecast-template.xlsx"
                )
              }
            >
              XLSX Template
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                handleDownload(
                  "/operational/templates/forecast",
                  "operational-forecast-template.csv",
                  { file_format: "csv" }
                )
              }
            >
              CSV
            </Button>
            <input
              ref={forecastInput}
              className="hidden"
              type="file"
              accept=".csv,.xlsx"
              onChange={onForecastFile}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300">
              <CalendarDays size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)]">Daily Actuals</h3>
              <p className="text-xs text-[var(--muted)]">
                One file per date; omitted forecast ASINs are counted as zero for the day
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={actualDate}
              onChange={(event) => setActualDate(event.target.value)}
            />
            <Button
              icon={<Upload size={15} />}
              disabled={!actualDate || uploadActual.isPending}
              onClick={() => actualInput.current?.click()}
            >
              {uploadActual.isPending ? "Uploading…" : "Upload Daily Actuals"}
            </Button>
            <Button
              variant="outline"
              icon={<Download size={14} />}
              onClick={() =>
                handleDownload(
                  "/operational/templates/actual",
                  "operational-actual-template.xlsx"
                )
              }
            >
              XLSX Template
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                handleDownload(
                  "/operational/templates/actual",
                  "operational-actual-template.csv",
                  { file_format: "csv" }
                )
              }
            >
              CSV
            </Button>
            <input
              ref={actualInput}
              className="hidden"
              type="file"
              accept=".csv,.xlsx"
              onChange={onActualFile}
            />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[var(--text)]">Reporting period</span>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            From
            <Input
              type="date"
              value={range.date_from}
              onChange={(event) => {
                const value = event.target.value;
                setFilters({
                  date_from: value || undefined,
                  date_to:
                    value && range.date_to && range.date_to < value
                      ? value
                      : range.date_to || undefined,
                });
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            To
            <Input
              type="date"
              value={range.date_to}
              onChange={(event) => {
                const value = event.target.value;
                setFilters({
                  date_from:
                    value && range.date_from && range.date_from > value
                      ? value
                      : range.date_from || undefined,
                  date_to: value || undefined,
                });
              }}
            />
          </label>
          {(filters.date_from || filters.date_to) && (
            <Button variant="ghost" onClick={() => setFilters({})}>
              Latest month
            </Button>
          )}
          <span className="ml-auto text-xs text-[var(--muted)]">
            {dashboard.data?.covered_days ?? 0} forecast days · 5% unit-cost tolerance
          </span>
        </div>
      </Card>

      {dashboard.isLoading ? (
        <Card><Spinner label="Calculating operational performance…" /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Unit Achievement"
              value={percent(summary?.unit_achievement_pct)}
              sub={`${formatNumber(summary?.actual_units)} actual / ${formatNumber(summary?.planned_units)} expected`}
              icon={<PackageCheck size={18} />}
            />
            <KpiCard
              label="Spend vs Adjusted Budget"
              value={formatINR(summary?.actual_spend)}
              sub={`${formatINR(summary?.adjusted_spend_variance)} variance vs ${formatINR(summary?.volume_adjusted_budget)} allowed`}
              icon={<WalletCards size={18} />}
            />
            <KpiCard
              label="PO Value Achievement"
              value={formatINR(summary?.actual_po_value)}
              sub={`${formatINR(summary?.po_value_variance)} vs paced target`}
              icon={<IndianRupee size={18} />}
            />
            <KpiCard
              label="Actual Cost / Unit"
              value={formatINR(summary?.actual_cost_per_unit)}
              sub={`${formatINR(summary?.planned_cost_per_unit)} planned per unit`}
              icon={<Gauge size={18} />}
            />
            <KpiCard
              label="Contribution After Spend"
              value={formatINR(summary?.contribution_value)}
              sub={`${percent(summary?.contribution_margin_pct)} contribution margin`}
              icon={<BarChart3 size={18} />}
            />
            <KpiCard
              label="Spend Utilization"
              value={percent(summary?.actual_spend_utilization_pct)}
              sub={`${percent(summary?.planned_spend_utilization_pct)} planned spend / PO value`}
              icon={<IndianRupee size={18} />}
            />
          </div>

          {dashboard.data && dashboard.data.categories.length > 0 && (
            <OperationalPerformanceVisuals dashboard={dashboard.data} />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text)]">Cumulative Units</h3>
              <p className="mb-4 text-xs text-[var(--muted)]">
                Each day adds the forecast DRR; missing actual rows add zero
              </p>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} width={55} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulative_expected_units"
                      name="Expected"
                      stroke="#8b90a0"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative_actual_units"
                      name="Actual"
                      stroke="#6d5efc"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-20 text-center text-sm text-[var(--muted)]">No forecast data.</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text)]">Cumulative Spend Control</h3>
              <p className="mb-4 text-xs text-[var(--muted)]">
                Adjusted budget scales with actual units, so productive overspend is not flagged
              </p>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} width={65} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulative_planned_spend"
                      name="Scheduled"
                      stroke="#8b90a0"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative_adjusted_budget"
                      name="Volume-adjusted"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative_actual_spend"
                      name="Actual"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-20 text-center text-sm text-[var(--muted)]">No forecast data.</p>
              )}
            </Card>
          </div>

          <Card>
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Category Performance</h3>
              <p className="text-xs text-[var(--muted)]">
                Select a category to drill down to ASINs. Component detail shows actual / adjusted budget.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1420px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-4 py-3">Category / ASIN</th>
                    <th className="px-4 py-3 text-right">Expected Units</th>
                    <th className="px-4 py-3 text-right">Actual Units</th>
                    <th className="px-4 py-3 text-right">Achievement</th>
                    <th className="px-4 py-3 text-right">Scheduled Spend</th>
                    <th className="px-4 py-3 text-right">Actual Spend</th>
                    <th className="px-4 py-3 text-right">Adjusted Budget</th>
                    <th className="px-4 py-3 text-right">Efficiency Variance</th>
                    <th className="px-4 py-3 text-right">Actual PO Value</th>
                    <th className="px-4 py-3 text-right">PO Variance</th>
                    <th className="px-4 py-3 text-right">Spend Util.</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.data?.categories ?? []).map((category) => (
                    <Fragment key={category.category}>
                      <tr
                        className="cursor-pointer border-b border-[var(--border)] bg-[var(--panel-2)]/50 hover:bg-[var(--panel-2)]"
                        onClick={() => toggleCategory(category.category)}
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--text)]">
                          <span className="flex items-center gap-2">
                            {expanded.has(category.category) ? (
                              <ChevronDown size={15} />
                            ) : (
                              <ChevronRight size={15} />
                            )}
                            {category.category}
                            <span className="text-xs font-normal text-[var(--muted)]">
                              {category.asins.length} ASINs
                            </span>
                          </span>
                          <SpendDetail row={category} />
                        </td>
                        <MetricCells row={category} />
                      </tr>
                      {expanded.has(category.category) &&
                        category.asins.map((asin) => (
                          <tr
                            key={`${category.category}-${asin.asin}`}
                            className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]/60"
                          >
                            <td className="py-3 pl-11 pr-4">
                              <p className="font-semibold text-[var(--text)]">{asin.short_name}</p>
                              <p className="text-xs text-[var(--muted)]">{asin.asin}</p>
                              <SpendDetail row={asin} />
                            </td>
                            <MetricCells row={asin} />
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                  {(dashboard.data?.categories ?? []).length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-5 py-12 text-center text-[var(--muted)]">
                        Upload a monthly forecast to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">File Management</h3>
        <p className="text-xs text-[var(--muted)]">
          Download, edit offline, delete the existing period, then upload its replacement.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h4 className="text-sm font-semibold text-[var(--text)]">Forecast Files</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-3">Month / File</th>
                  <th className="px-4 py-3 text-right">ASINs</th>
                  <th className="px-4 py-3 text-right">Budget</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(forecasts.data ?? []).map((file) => (
                  <tr key={file.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{monthLabel(file.forecast_month)}</p>
                      <p className="max-w-[250px] truncate text-xs text-[var(--muted)]">{file.filename}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">{file.row_count}</td>
                    <td className="px-4 py-3 text-right text-[var(--text)]">{formatINR(file.total_budget)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          title="Download original"
                          icon={<Download size={14} />}
                          onClick={() =>
                            handleDownload(
                              `/operational/forecasts/${file.id}/download`,
                              file.filename
                            )
                          }
                        />
                        <IconButton
                          title="Delete forecast"
                          icon={<Trash2 size={14} />}
                          className="hover:text-rose-400"
                          onClick={() => removeForecast(file.id, monthLabel(file.forecast_month))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {(forecasts.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">No forecasts uploaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h4 className="text-sm font-semibold text-[var(--text)]">Daily Actual Files</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-3">Date / File</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(actuals.data ?? []).map((file) => (
                  <tr key={file.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text)]">{formatDate(file.report_date)}</p>
                      <p className="max-w-[250px] truncate text-xs text-[var(--muted)]">{file.filename}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">{file.row_count}</td>
                    <td className="px-4 py-3 text-right text-[var(--text)]">{formatINR(file.total_spend)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          title="Download original"
                          icon={<Download size={14} />}
                          onClick={() =>
                            handleDownload(`/operational/actuals/${file.id}/download`, file.filename)
                          }
                        />
                        <IconButton
                          title="Delete daily actuals"
                          icon={<Trash2 size={14} />}
                          className="hover:text-rose-400"
                          onClick={() => removeActual(file.id, formatDate(file.report_date))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {(actuals.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">No daily actuals uploaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCells({ row }: { row: OperationalMetrics }) {
  return (
    <>
      <td className="px-4 py-3 text-right text-[var(--muted)]">{formatNumber(row.planned_units)}</td>
      <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">{formatNumber(row.actual_units)}</td>
      <td className="px-4 py-3 text-right text-[var(--text)]">{percent(row.unit_achievement_pct)}</td>
      <td className="px-4 py-3 text-right text-[var(--muted)]">{formatINR(row.planned_spend)}</td>
      <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">{formatINR(row.actual_spend)}</td>
      <td className="px-4 py-3 text-right text-emerald-400">{formatINR(row.volume_adjusted_budget)}</td>
      <td
        className={`px-4 py-3 text-right font-semibold ${
          row.adjusted_spend_variance <= 0 ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {formatINR(row.adjusted_spend_variance)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">{formatINR(row.actual_po_value)}</td>
      <td className={`px-4 py-3 text-right ${row.po_value_variance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {formatINR(row.po_value_variance)}
      </td>
      <td className="px-4 py-3 text-right text-[var(--text)]">{percent(row.actual_spend_utilization_pct)}</td>
      <td className="px-4 py-3">{statusBadge(row.status)}</td>
    </>
  );
}
