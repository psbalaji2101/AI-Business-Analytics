import { Fragment, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PackageCheck,
  Plus,
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
  useAddOperationalTargetAsins,
  useDeleteOperationalActual,
  useDeleteOperationalForecast,
  useDeleteOperationalTargetAmendment,
  useOperationalActuals,
  useOperationalDashboard,
  useOperationalForecastAmendments,
  useOperationalForecasts,
  useUploadOperationalActual,
  useUploadOperationalForecast,
  type OperationalFilters,
} from "../api/hooks";
import { api } from "../api/client";
import type {
  OperationalActualUploadResult,
  OperationalForecastUpload,
  OperationalMetrics,
} from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, KpiCard } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Input, Spinner } from "../components/ui/Spinner";
import { errorMessage, useToast } from "../components/ui/Toast";
import {
  formatDate,
  formatINR as formatPreciseINR,
  formatRoundedINR as formatINR,
  formatRoundedNumber as formatNumber,
} from "../lib/utils";
import { OperationalPerformanceVisuals } from "../components/operational/OperationalPerformanceVisuals";
import { CategorySpendControl } from "../components/operational/CategorySpendControl";
import { ManagementTrendTable } from "../components/operational/ManagementTrendTable";
import { ManagementUnitEconomicsTable } from "../components/operational/ManagementUnitEconomicsTable";

const today = new Date().toISOString().slice(0, 10);

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value)}%`;
}

function monthLabel(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function monthEndDate(value: string) {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function nextDate(value: string) {
  const result = new Date(`${value}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString().slice(0, 10);
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
    ["CCOGS + Ads", row.spend_breakdown.ccogs_ads],
    ["Review", row.spend_breakdown.reviews],
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
  const [amendmentTarget, setAmendmentTarget] =
    useState<OperationalForecastUpload | null>(null);
  const [amendmentDate, setAmendmentDate] = useState(today);
  const [amendmentFile, setAmendmentFile] = useState<File | null>(null);
  const [amendmentError, setAmendmentError] = useState<string | null>(null);
  const [lastActualReconciliation, setLastActualReconciliation] =
    useState<OperationalActualUploadResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedActualFiles, setExpandedActualFiles] = useState<Set<number>>(new Set());
  const forecastInput = useRef<HTMLInputElement>(null);
  const actualInput = useRef<HTMLInputElement>(null);
  const amendmentInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const dashboard = useOperationalDashboard(filters);
  const forecasts = useOperationalForecasts();
  const amendments = useOperationalForecastAmendments();
  const actuals = useOperationalActuals();
  const managementDates = [...new Set((actuals.data ?? []).map((file) => file.report_date))]
    .sort((left, right) => right.localeCompare(left))
    .slice(0, 3)
    .sort();
  const managementDashboard = useOperationalDashboard(
    managementDates.length
      ? {
          date_from: managementDates[0],
          date_to: managementDates[managementDates.length - 1],
        }
      : {}
  );
  const latestActualDate = managementDates[managementDates.length - 1];
  const mtdDashboard = useOperationalDashboard(
    latestActualDate
      ? {
          date_from: `${latestActualDate.slice(0, 7)}-01`,
          date_to: latestActualDate,
        }
      : {}
  );
  const uploadForecast = useUploadOperationalForecast();
  const addTargetAsins = useAddOperationalTargetAsins();
  const uploadActual = useUploadOperationalActual();
  const deleteForecast = useDeleteOperationalForecast();
  const deleteTargetAmendment = useDeleteOperationalTargetAmendment();
  const deleteActual = useDeleteOperationalActual();
  const selectedForecast = (forecasts.data ?? []).find(
    (file) => file.forecast_month.slice(0, 7) === forecastMonth
  );

  const range = {
    date_from: filters.date_from ?? dashboard.data?.date_from ?? "",
    date_to: filters.date_to ?? dashboard.data?.date_to ?? "",
  };

  const copyAsins = async (asins: string[]) => {
    try {
      const value = asins.join("\n");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy command failed");
      }
      toast.success(`${formatNumber(asins.length)} ASINs copied.`);
    } catch {
      toast.error("Could not copy the ASIN list. Please try again.");
    }
  };

  const onForecastFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadForecast.mutateAsync({ file, month: forecastMonth });
      toast.success(
        `${monthLabel(result.period)} target uploaded: ${formatNumber(result.row_count)} ASINs.`
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
      setLastActualReconciliation(result);
      toast.success(
        result.unmatched_asins.length
          ? `${formatDate(result.period)} actuals uploaded: ${formatNumber(result.row_count)} matched ASINs. ${formatNumber(result.unmatched_asins.length)} ASINs with ${formatNumber(result.unmatched_units)} orders were excluded.`
          : `${formatDate(result.period)} actuals uploaded: ${formatNumber(result.row_count)} ASINs. All rows matched the target.`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (actualInput.current) actualInput.current.value = "";
    }
  };

  const openAmendment = (target: OperationalForecastUpload) => {
    const month = target.forecast_month.slice(0, 7);
    const monthActualDates = (actuals.data ?? [])
      .map((file) => file.report_date)
      .filter((reportDate) => reportDate.startsWith(month))
      .sort();
    const latestActual = monthActualDates[monthActualDates.length - 1];
    const earliestDate = latestActual
      ? nextDate(latestActual)
      : today.startsWith(month)
        ? today
        : target.forecast_month;
    setAmendmentTarget(target);
    setAmendmentDate(
      earliestDate > monthEndDate(month) ? monthEndDate(month) : earliestDate
    );
    setAmendmentFile(null);
    setAmendmentError(null);
    if (amendmentInput.current) amendmentInput.current.value = "";
  };

  const closeAmendment = () => {
    if (addTargetAsins.isPending) return;
    setAmendmentTarget(null);
    setAmendmentFile(null);
    setAmendmentError(null);
  };

  const submitAmendment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!amendmentTarget || !amendmentFile || !amendmentDate) {
      setAmendmentError("Choose an effective date and a target file containing new ASINs.");
      return;
    }
    setAmendmentError(null);
    try {
      const result = await addTargetAsins.mutateAsync({
        uploadId: amendmentTarget.id,
        file: amendmentFile,
        effectiveFrom: amendmentDate,
      });
      toast.success(
        `${formatNumber(result.row_count)} ASINs added from ${formatDate(result.period)}. Existing actuals were preserved.`
      );
      setAmendmentTarget(null);
      setAmendmentFile(null);
    } catch (error) {
      setAmendmentError(errorMessage(error));
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
    if (!confirm(`Delete the ${label} target? Download the original first if you need a copy.`)) {
      return;
    }
    try {
      await deleteForecast.mutateAsync(id);
      toast.success("Target deleted. You can now upload its replacement.");
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

  const removeAmendment = async (id: number, filename: string) => {
    if (
      !confirm(
        `Remove ${filename} from the active target? Daily actual files will be preserved, but these ASINs will no longer appear in target analytics.`
      )
    ) {
      return;
    }
    try {
      await deleteTargetAmendment.mutateAsync(id);
      toast.success("Added target file removed. All daily actual files were preserved.");
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
          <h2 className="text-2xl font-bold text-[var(--text)]">Target Vs Achieved</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Target versus achieved performance, adjusted for the unit economics of every ASIN
          </p>
        </div>
        <Button
          variant="outline"
          icon={<Download size={15} />}
          disabled={!dashboard.data?.categories.length}
          onClick={() =>
            handleDownload("/operational/dashboard/export", "target-vs-achieved.csv", {
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
              <h3 className="font-semibold text-[var(--text)]">Monthly Target</h3>
              <p className="text-xs text-[var(--muted)]">
                PO value is calculated as Daily Run Rate × PO Price, alongside the monthly budgets
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
              disabled={!forecastMonth || uploadForecast.isPending || Boolean(selectedForecast)}
              onClick={() => forecastInput.current?.click()}
            >
              {uploadForecast.isPending
                ? "Uploading…"
                : selectedForecast
                  ? "Target Exists"
                  : "Upload Target"}
            </Button>
            {selectedForecast && (
              <Button
                variant="outline"
                icon={<Plus size={14} />}
                onClick={() => openAmendment(selectedForecast)}
              >
                Add ASINs
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Download size={14} />}
              onClick={() =>
                handleDownload(
                  "/operational/templates/forecast",
                  "Monthly Target.xlsx"
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
                  "Monthly Target.csv",
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
                ASINs missing from the monthly target are reported and excluded from dashboard totals
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

      {lastActualReconciliation?.unmatched_asins.length ? (
        <Card className="border-amber-500/40 bg-amber-500/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">
                    Actual ASINs missing from target
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDate(lastActualReconciliation.period)} · {lastActualReconciliation.filename}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="amber">
                    {formatNumber(lastActualReconciliation.unmatched_asins.length)} ASINs ·{" "}
                    {formatNumber(lastActualReconciliation.unmatched_units)} orders excluded
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    icon={<Copy size={14} />}
                    onClick={() =>
                      copyAsins(lastActualReconciliation.unmatched_asins.map((item) => item.asin))
                    }
                  >
                    Copy ASINs
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                The file contains {formatNumber(lastActualReconciliation.source_units)} orders.
                The dashboard includes {formatNumber(lastActualReconciliation.units)} matched orders
                and excludes the ASINs below.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-amber-500/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-500/20 text-left text-xs text-[var(--muted)]">
                      <th className="px-4 py-2">ASIN in Actual</th>
                      <th className="px-4 py-2 text-right">Orders excluded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastActualReconciliation.unmatched_asins.map((item) => (
                      <tr key={item.asin} className="border-b border-amber-500/10 last:border-0">
                        <td className="px-4 py-2 font-medium text-[var(--text)]">{item.asin}</td>
                        <td className="px-4 py-2 text-right text-amber-300">
                          {formatNumber(item.orders)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="border-violet-500/40">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-[var(--border)] bg-violet-500/[0.06] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Overall performance</h3>
              <Badge variant="violet">All categories</Badge>
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Aggregate statistics for the selected reporting period
            </p>
          </div>
          <span className="text-xs text-[var(--muted)]">
            {dashboard.data?.covered_days ?? 0} target days · 5% unit-cost tolerance
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
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
        </div>

        {dashboard.isLoading ? (
          <Spinner label="Calculating operational performance…" />
        ) : (
          <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Unit Achievement"
              value={percent(summary?.unit_achievement_pct)}
              sub={`${formatNumber(summary?.actual_units)} actual / ${formatNumber(summary?.planned_units)} target`}
              icon={<PackageCheck size={18} />}
              description="Actual orders divided by target orders for the selected period. 100% means the target was met."
              embedded
            />
            <KpiCard
              label="Spend vs Adjusted Budget"
              value={formatINR(summary?.actual_spend)}
              sub={`${formatINR(summary?.adjusted_spend_variance)} variance vs ${formatINR(summary?.volume_adjusted_budget)} allowed`}
              icon={<WalletCards size={18} />}
              description="Total actual ADS+Cogs and OPA spend. The allowed budget scales with actual order volume; a positive variance means overspend."
              embedded
            />
            <KpiCard
              label="PO Value Achievement"
              value={formatINR(summary?.actual_po_value)}
              sub={`${formatINR(summary?.po_value_variance)} vs paced target`}
              icon={<IndianRupee size={18} />}
              description="Actual orders multiplied by the uploaded PO Price, compared with the target PO value paced across the selected days."
              embedded
            />
            <KpiCard
              label="Contribution After Spend"
              value={formatINR(summary?.contribution_value)}
              sub={`${percent(summary?.contribution_margin_pct)} contribution margin`}
              icon={<BarChart3 size={18} />}
              description="Actual PO value minus total actual spend. The percentage below is the contribution as a share of actual PO value."
              embedded
            />
            <KpiCard
              label="Spend Utilization"
              value={percent(summary?.actual_spend_utilization_pct)}
              sub={`${percent(summary?.planned_spend_utilization_pct)} planned spend / PO value`}
              icon={<IndianRupee size={18} />}
              description="Total actual spend divided by actual PO value. The comparison below uses target spend divided by target PO value."
              className="sm:col-span-2 xl:col-span-1"
              embedded
            />
          </div>
        )}
      </Card>

      {!dashboard.isLoading && (
        <>
          {dashboard.data && dashboard.data.categories.length > 0 && (
            <CategorySpendControl dashboard={dashboard.data} />
          )}

          {managementDashboard.data && !actuals.isLoading && (
            <ManagementTrendTable
              dashboard={managementDashboard.data}
              dates={managementDates}
            />
          )}

          {mtdDashboard.data && latestActualDate && !actuals.isLoading && (
            <ManagementUnitEconomicsTable dashboard={mtdDashboard.data} />
          )}

          {dashboard.data && dashboard.data.categories.length > 0 && (
            <OperationalPerformanceVisuals dashboard={dashboard.data} />
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--text)]">Cumulative Units</h3>
              <p className="mb-4 text-xs text-[var(--muted)]">
                Each day adds the target DRR; missing actual rows add zero
              </p>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" stroke="var(--muted)" fontSize={11} tickLine={false} />
                    <YAxis
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
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cumulative_expected_units"
                      name="Target"
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
                <p className="py-20 text-center text-sm text-[var(--muted)]">No target data.</p>
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
                    <YAxis
                      stroke="var(--muted)"
                      fontSize={11}
                      tickLine={false}
                      width={65}
                      tickFormatter={(value) => formatNumber(Number(value))}
                    />
                    <Tooltip
                      formatter={(value) => formatINR(Number(value))}
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
                      name="Target"
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
                <p className="py-20 text-center text-sm text-[var(--muted)]">No target data.</p>
              )}
            </Card>
          </div>

          <Card className="flex h-[680px] flex-col overflow-hidden">
            <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--text)]">Category Performance</h3>
              <p className="text-xs text-[var(--muted)]">
                Select a category to drill down to ASINs. Component detail shows actual / adjusted budget.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[1660px] text-sm">
                <thead className="sticky top-0 z-20 bg-[var(--panel)] shadow-[0_1px_0_var(--border)]">
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    <th className="sticky left-0 z-30 bg-[var(--panel)] px-4 py-3 shadow-[1px_0_0_var(--border)]">
                      Category / ASIN
                    </th>
                    <th className="px-4 py-3 text-right">Target Units</th>
                    <th className="px-4 py-3 text-right">Actual Units</th>
                    <MetricHeader
                      label="Achievement"
                      description="Actual units divided by target units for the selected period."
                    />
                    <th className="px-4 py-3 text-right">Target Spend</th>
                    <th className="px-4 py-3 text-right">Actual Spend</th>
                    <MetricHeader
                      label="Target CAC"
                      description="Target CCOGS + Ads budget divided by target orders. Uses target data only."
                    />
                    <MetricHeader
                      label="Actual CAC"
                      description="CCOGS + Ads spend divided by actual orders."
                    />
                    <MetricHeader
                      label="Adjusted Budget"
                      description="Target spend allowance scaled to the actual order volume."
                    />
                    <MetricHeader
                      label="Efficiency Variance"
                      description="Actual spend minus the volume-adjusted budget. Positive values mean overspend."
                    />
                    <th className="px-4 py-3 text-right">Actual PO Value</th>
                    <MetricHeader
                      label="PO Variance"
                      description="Actual PO value minus the paced target PO value."
                    />
                    <MetricHeader
                      label="Spend Util."
                      description="Actual spend divided by actual PO value."
                    />
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
                        <td className="sticky left-0 z-10 bg-[var(--panel-2)] px-4 py-3 font-semibold text-[var(--text)] shadow-[1px_0_0_var(--border)]">
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
                            <td className="sticky left-0 z-10 bg-[var(--panel)] py-3 pl-11 pr-4 shadow-[1px_0_0_var(--border)]">
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
                      <td colSpan={14} className="px-5 py-12 text-center text-[var(--muted)]">
                        Upload a monthly target to begin.
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
          Add newly launched ASINs without deleting the target or any daily actuals.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex h-[360px] flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
            <h4 className="text-sm font-semibold text-[var(--text)]">Target Files</h4>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--panel)] shadow-[0_1px_0_var(--border)]">
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-3 py-2">Month / File</th>
                  <th className="px-3 py-2 text-right">ASINs</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(forecasts.data ?? []).map((file) => (
                  <Fragment key={file.id}>
                    <tr className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-[var(--text)]">
                          {monthLabel(file.forecast_month)}
                        </p>
                        <p className="max-w-[250px] truncate text-xs text-[var(--muted)]">
                          Current target · {file.filename}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--muted)]">
                        {file.row_count}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--text)]">
                        {formatINR(file.total_budget)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            title="Add new ASINs"
                            icon={<Plus size={14} />}
                            className="hover:text-violet-400"
                            onClick={() => openAmendment(file)}
                          />
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
                            title="Delete target"
                            icon={<Trash2 size={14} />}
                            className="hover:text-rose-400"
                            onClick={() =>
                              removeForecast(file.id, monthLabel(file.forecast_month))
                            }
                          />
                        </div>
                      </td>
                    </tr>
                    {(amendments.data ?? [])
                      .filter((amendment) => amendment.forecast_upload_id === file.id)
                      .map((amendment) => (
                        <tr
                          key={`amendment-${amendment.id}`}
                          className="border-b border-[var(--border)] bg-violet-500/[0.04]"
                        >
                          <td className="py-1.5 pl-7 pr-3">
                            <p className="text-xs font-medium text-violet-300">
                              Added from {formatDate(amendment.effective_from)}
                            </p>
                            <p className="max-w-[230px] truncate text-xs text-[var(--muted)]">
                              {amendment.filename}
                            </p>
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-[var(--muted)]">
                            +{amendment.row_count}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-[var(--muted)]">
                            {formatINR(amendment.total_budget)}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex justify-end gap-1">
                              <IconButton
                                title="Download amendment"
                                icon={<Download size={14} />}
                                onClick={() =>
                                  handleDownload(
                                    `/operational/forecast-amendments/${amendment.id}/download`,
                                    amendment.filename
                                  )
                                }
                              />
                              <IconButton
                                title="Delete added target file"
                                icon={<Trash2 size={14} />}
                                className="hover:text-rose-400"
                                disabled={deleteTargetAmendment.isPending}
                                onClick={() =>
                                  removeAmendment(amendment.id, amendment.filename)
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
                {(forecasts.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">No targets uploaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex h-[360px] flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
            <h4 className="text-sm font-semibold text-[var(--text)]">Daily Actual Files</h4>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--panel)] shadow-[0_1px_0_var(--border)]">
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-3 py-2">Date / File</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                  <th className="px-3 py-2">Missing in Target</th>
                  <th className="px-3 py-2 text-right">Spend</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(actuals.data ?? []).map((file) => (
                  <Fragment key={file.id}>
                    <tr className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-[var(--text)]">
                          {formatDate(file.report_date)}
                        </p>
                        <p className="max-w-[250px] truncate text-xs text-[var(--muted)]">
                          {file.filename}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <p className="font-medium text-[var(--text)]">
                          {formatNumber(file.actual_units)} included
                        </p>
                        {file.unmatched_asins.length > 0 && (
                          <p className="text-xs text-[var(--muted)]">
                            {formatNumber(file.source_units)} in file
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {file.unmatched_asins.length > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-left text-xs font-medium text-amber-300 hover:bg-amber-500/15"
                            onClick={() =>
                              setExpandedActualFiles((current) => {
                                const next = new Set(current);
                                if (next.has(file.id)) next.delete(file.id);
                                else next.add(file.id);
                                return next;
                              })
                            }
                          >
                            <AlertTriangle size={13} />
                            {formatNumber(file.unmatched_asins.length)} ASINs ·{" "}
                            {formatNumber(file.unmatched_units)} orders
                            {expandedActualFiles.has(file.id) ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </button>
                        ) : (
                          <Badge variant="green">All matched</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--text)]">
                        {formatINR(file.total_spend)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            title="Download original"
                            icon={<Download size={14} />}
                            onClick={() =>
                              handleDownload(
                                `/operational/actuals/${file.id}/download`,
                                file.filename
                              )
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
                    {expandedActualFiles.has(file.id) && file.unmatched_asins.length > 0 && (
                      <tr className="border-b border-[var(--border)] bg-amber-500/[0.04]">
                        <td colSpan={5} className="px-3 py-2">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-[var(--muted)]">
                              Excluded because these ASINs were not present in the target effective
                              on {formatDate(file.report_date)}.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              icon={<Copy size={14} />}
                              onClick={() =>
                                copyAsins(file.unmatched_asins.map((item) => item.asin))
                              }
                            >
                              Copy ASINs
                            </Button>
                          </div>
                          <div className="max-h-44 overflow-auto rounded-lg border border-amber-500/20">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-amber-500/20 text-left text-[var(--muted)]">
                                  <th className="px-3 py-2">ASIN in Actual</th>
                                  <th className="px-3 py-2 text-right">Orders excluded</th>
                                </tr>
                              </thead>
                              <tbody>
                                {file.unmatched_asins.map((item) => (
                                  <tr
                                    key={item.asin}
                                    className="border-b border-amber-500/10 last:border-0"
                                  >
                                    <td className="px-3 py-2 font-medium text-[var(--text)]">
                                      {item.asin}
                                    </td>
                                    <td className="px-3 py-2 text-right text-amber-300">
                                      {formatNumber(item.orders)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {(actuals.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">No daily actuals uploaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={amendmentTarget !== null}
        title={
          amendmentTarget
            ? `Add ASINs to ${monthLabel(amendmentTarget.forecast_month)}`
            : "Add ASINs to Target"
        }
        onClose={closeAmendment}
      >
        <form className="space-y-4" onSubmit={submitAmendment}>
          <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] p-3 text-sm text-[var(--muted)]">
            Upload only newly launched ASINs using the Monthly Target template. Existing target
            rows and all daily actual files will remain unchanged.
          </div>
          {amendmentError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {amendmentError}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">
              Effective from
            </label>
            <Input
              className="w-full"
              type="date"
              required
              min={amendmentTarget?.forecast_month}
              max={
                amendmentTarget
                  ? monthEndDate(amendmentTarget.forecast_month)
                  : undefined
              }
              value={amendmentDate}
              onChange={(event) => setAmendmentDate(event.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Target units and daily budget pacing begin on this date. It must be after the latest
              uploaded actual for the month.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">
              New-ASIN target file
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                icon={<Upload size={14} />}
                onClick={() => amendmentInput.current?.click()}
              >
                Choose File
              </Button>
              <span className="min-w-0 truncate text-xs text-[var(--muted)]">
                {amendmentFile?.name ?? "No file selected"}
              </span>
            </div>
            <input
              ref={amendmentInput}
              className="hidden"
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => {
                setAmendmentFile(event.target.files?.[0] ?? null);
                setAmendmentError(null);
              }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeAmendment}
              disabled={addTargetAsins.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addTargetAsins.isPending || !amendmentFile || !amendmentDate}
            >
              {addTargetAsins.isPending ? "Adding…" : "Add ASINs"}
            </Button>
          </div>
        </form>
      </Modal>
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
      <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">{formatPreciseINR(row.target_cac)}</td>
      <td className="px-4 py-3 text-right font-semibold text-violet-400">{formatPreciseINR(row.cac)}</td>
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

function MetricHeader({ label, description }: { label: string; description: string }) {
  return (
    <th className="px-4 py-3 text-right" title={description}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">{label}</span>
    </th>
  );
}
