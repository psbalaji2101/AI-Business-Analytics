import { useRef, useState } from "react";
import {
  ArrowUpDown,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useAsins,
  useBulkUpload,
  useCreateAsin,
  useDeleteAsin,
  useUpdateAsin,
} from "../api/hooks";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Input, Select, Spinner } from "../components/ui/Spinner";
import { AsinFormModal, type AsinFormValues } from "../components/asins/AsinFormModal";
import { useToast, errorMessage } from "../components/ui/Toast";
import { formatDate } from "../lib/utils";
import type { Asin } from "../api/types";

const AMAZON = "https://www.amazon.in/dp/";
const PAGE_SIZE = 10;

const SAMPLE_CSV =
  "asin,product_name,category,sub_category\nB0EXAMPLE01,Sample Product,Accessories,Mobile Holder\n";

export default function ManageAsins() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("-date_added");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asin | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const { data, isLoading } = useAsins({
    q: q || undefined,
    category: category || undefined,
    page,
    page_size: PAGE_SIZE,
    sort,
  });
  const create = useCreateAsin();
  const update = useUpdateAsin();
  const remove = useDeleteAsin();
  const bulk = useBulkUpload();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const categories = Array.from(
    new Set((data?.items ?? []).map((a) => a.category).filter(Boolean) as string[])
  );

  const toggleSort = (field: string) =>
    setSort((s) => (s === field ? `-${field}` : field));

  const handleSubmit = async (values: AsinFormValues) => {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success(`ASIN ${values.asin} updated.`);
      } else {
        await create.mutateAsync(values);
        toast.success(`ASIN ${values.asin} added.`);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const handleDelete = async (a: Asin) => {
    if (!confirm(`Delete ASIN ${a.asin}? This removes it and its history permanently.`)) return;
    try {
      await remove.mutateAsync(a.id);
      toast.success(`ASIN ${a.asin} deleted.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asin-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await bulk.mutateAsync(file);
      toast.success(
        `Uploaded: ${result.created} created, ${result.skipped} skipped. Scraping started…`
      );
      if (result.errors?.length) toast.error(`${result.errors.length} row(s) had errors.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)]">ASIN Catalog Management</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add, update or delete ASINs tracked by the scraping engine
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Download size={15} />} onClick={downloadSample}>
            Sample CSV
          </Button>
          <Button
            variant="outline"
            icon={<Upload size={15} />}
            onClick={() => fileRef.current?.click()}
          >
            Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            icon={<Plus size={15} />}
            onClick={() => {
              setEditing(null);
              setFormError(null);
              setModalOpen(true);
            }}
          >
            Add ASIN
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <Input
            className="w-full pl-9"
            placeholder="Search catalog by ASIN, product name or category..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
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

      {/* Table */}
      <Card>
        {isLoading ? (
          <Spinner label="Loading catalog…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-5 py-3">Sl.No</th>
                  <Th label="ASIN" field="asin" sort={sort} onSort={toggleSort} />
                  <Th label="Product Name" field="product_name" sort={sort} onSort={toggleSort} />
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Sub Category</th>
                  <Th label="Date Added" field="date_added" sort={sort} onSort={toggleSort} />
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((a, i) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-2)]"
                  >
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={`${AMAZON}${a.asin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[var(--text)] hover:text-[var(--accent)]"
                      >
                        {a.asin} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="px-5 py-3 text-[var(--text)]">{a.product_name}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{a.category ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{a.sub_category ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{formatDate(a.date_added)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={a.is_active ? "green" : "gray"}>
                        {a.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton
                          icon={<Pencil size={14} />}
                          onClick={() => {
                            setEditing(a);
                            setFormError(null);
                            setModalOpen(true);
                          }}
                        />
                        <IconButton
                          icon={<Trash2 size={14} />}
                          className="hover:text-rose-400"
                          onClick={() => handleDelete(a)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-[var(--muted)]">
                      No ASINs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-sm text-[var(--muted)]">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AsinFormModal
        open={modalOpen}
        editing={editing}
        submitting={create.isPending || update.isPending}
        error={formError}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function Th({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (f: string) => void;
}) {
  const active = sort === field || sort === `-${field}`;
  return (
    <th className="px-5 py-3">
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 ${active ? "text-[var(--text)]" : ""}`}
      >
        {label} <ArrowUpDown size={12} />
      </button>
    </th>
  );
}
