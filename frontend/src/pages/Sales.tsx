import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  IndianRupee,
  MapPin,
  Package2,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useDeleteSalesUpload,
  useSalesByAsin,
  useSalesByState,
  useSalesSummary,
  useSalesUploads,
  useUploadSales,
  type SalesFilters,
} from "../api/hooks";
import { Card, KpiCard } from "../components/ui/Card";
import { Button, IconButton } from "../components/ui/Button";
import { Input, Select, Spinner } from "../components/ui/Spinner";
import { IndiaMap } from "../components/sales/IndiaMap";
import { AsinCombo } from "../components/sales/AsinCombo";
import { useToast, errorMessage } from "../components/ui/Toast";
import { formatDate, formatINR, formatNumber } from "../lib/utils";

const AMAZON = "https://www.amazon.in/dp/";

export default function Sales() {
  const [filters, setFilters] = useState<SalesFilters>({});
  const [rowLimit, setRowLimit] = useState(50);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const summary = useSalesSummary(filters);
  const byAsin = useSalesByAsin(filters);
  const byState = useSalesByState(filters);
  const uploads = useSalesUploads();
  const upload = useUploadSales();
  const removeUpload = useDeleteSalesUpload();
  // Unfiltered ASIN list to populate the filter dropdown (stable regardless of selection).
  const asinOptions = useSalesByAsin({});

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      if (result.duplicate) {
        toast.error(`Duplicate file — already uploaded. No rows added.`);
      } else if (result.inserted === 0) {
        toast.error(result.errors?.[0] ?? "No valid rows found.");
      } else {
        toast.success(
          `Uploaded ${file.name}: ${formatNumber(result.inserted)} rows, ` +
            `${formatNumber(result.total_units)} units, ${formatINR(result.total_gross)}.`
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteUpload = async (id: number, name: string) => {
    if (!confirm(`Delete upload "${name}" and all its sales rows?`)) return;
    try {
      await removeUpload.mutateAsync(id);
      toast.success("Upload deleted.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const s = summary.data;

  // Client-side paging for the per-ASIN table; page size = the Rows selector.
  const asinRows = byAsin.data ?? [];
  const asinPages = Math.max(1, Math.ceil(asinRows.length / rowLimit));
  const asinPage = Math.min(page, asinPages);
  const pagedAsins = asinRows.slice((asinPage - 1) * rowLimit, asinPage * rowLimit);

  // Reset to the first page when the filters or page size change.
  useEffect(() => {
    setPage(1);
  }, [filters, rowLimit]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Sales Report</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload Amazon sales exports to analyze units, revenue and order geography
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<Upload size={15} />}
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? "Uploading…" : "Upload Sales CSV"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <AsinCombo
          options={asinOptions.data ?? []}
          value={filters.asin}
          onChange={(asin) => setFilters((f) => ({ ...f, asin }))}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          From
          <Input
            type="date"
            value={filters.date_from ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          To
          <Input
            type="date"
            value={filters.date_to ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
          />
        </label>
        {(filters.asin || filters.date_from || filters.date_to) && (
          <Button variant="ghost" onClick={() => setFilters({})}>
            Clear
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Units Sold"
          value={formatNumber(s?.total_units ?? 0)}
          icon={<Package2 size={18} />}
          sub={s?.date_from ? `${formatDate(s.date_from)} – ${formatDate(s.date_to)}` : undefined}
        />
        <KpiCard
          label="Gross Sales"
          value={formatINR(s?.total_gross ?? 0)}
          icon={<IndianRupee size={18} />}
        />
        <KpiCard
          label="Orders"
          value={formatNumber(s?.total_orders ?? 0)}
          icon={<ShoppingCart size={18} />}
          sub={s ? `${s.distinct_asins} ASINs` : undefined}
        />
        <KpiCard
          label="States"
          value={formatNumber(s?.distinct_states ?? 0)}
          icon={<MapPin size={18} />}
        />
      </div>

      {/* Map */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text)]">Orders by State</h3>
        <p className="mb-2 text-xs text-[var(--muted)]">
          Colour intensity ∝ units sold. Hover a state for details.
        </p>
        {byState.isLoading ? (
          <Spinner label="Loading map…" />
        ) : (byState.data ?? []).length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--muted)]">
            No sales data yet. Upload a report to populate the map.
          </p>
        ) : (
          <IndiaMap data={byState.data!} />
        )}
      </Card>

      {/* Per-ASIN table */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Sales by Product (ASIN)</h3>
            <p className="text-xs text-[var(--muted)]">
              Product names come from the ASIN catalog (Manage ASINs) and are not overwritten by the
              uploaded file.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Rows
            <Select
              value={rowLimit}
              onChange={(e) => setRowLimit(Number(e.target.value))}
              className="py-1.5"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </Select>
          </label>
        </div>
        {byAsin.isLoading ? (
          <Spinner label="Loading…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-3">ASIN</th>
                  <th className="px-5 py-3">Product Name</th>
                  <th className="px-5 py-3 text-right">Units</th>
                  <th className="px-5 py-3 text-right">Gross Sales</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                </tr>
              </thead>
              <tbody>
                {pagedAsins.map((r) => (
                  <tr
                    key={r.asin}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]"
                  >
                    <td className="px-5 py-3">
                      <a
                        href={`${AMAZON}${r.asin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                      >
                        {r.asin} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="max-w-[420px] truncate px-5 py-3 text-[var(--text)]">
                      {r.product_name}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--text)]">
                      {formatNumber(r.units)}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--text)]">
                      {formatINR(r.gross_sales)}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--muted)]">
                      {formatNumber(r.orders)}
                    </td>
                  </tr>
                ))}
                {asinRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[var(--muted)]">
                      No sales data. Upload a report to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {asinRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
            <span>
              {(asinPage - 1) * rowLimit + 1}–{Math.min(asinPage * rowLimit, asinRows.length)} of{" "}
              {asinRows.length} products
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={asinPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={asinPage >= asinPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Uploaded files */}
      <Card>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Uploaded Files</h3>
          <p className="text-xs text-[var(--muted)]">
            Re-uploading the same file is detected by content and skipped to avoid duplicate rows.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Uploaded</th>
                <th className="px-5 py-3 text-right">Rows</th>
                <th className="px-5 py-3 text-right">Units</th>
                <th className="px-5 py-3 text-right">Gross</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(uploads.data ?? []).map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]"
                >
                  <td className="px-5 py-3 text-[var(--text)]">{u.filename}</td>
                  <td className="px-5 py-3 text-[var(--muted)]">{formatDate(u.uploaded_at)}</td>
                  <td className="px-5 py-3 text-right text-[var(--muted)]">
                    {formatNumber(u.row_count)}
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--muted)]">
                    {formatNumber(u.total_units)}
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--muted)]">
                    {formatINR(u.total_gross)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <IconButton
                        icon={<Trash2 size={14} />}
                        className="hover:text-rose-400"
                        onClick={() => handleDeleteUpload(u.id, u.filename)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {(uploads.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--muted)]">
                    No files uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
