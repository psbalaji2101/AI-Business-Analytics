import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Spinner";
import type { Asin } from "../../api/types";

export interface AsinFormValues {
  asin: string;
  product_name: string;
  category: string;
  sub_category: string;
  is_active: boolean;
}

const EMPTY: AsinFormValues = {
  asin: "",
  product_name: "",
  category: "",
  sub_category: "",
  is_active: true,
};

export function AsinFormModal({
  open,
  editing,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Asin | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: AsinFormValues) => void;
}) {
  const [values, setValues] = useState<AsinFormValues>(EMPTY);

  useEffect(() => {
    if (editing) {
      setValues({
        asin: editing.asin,
        product_name: editing.product_name,
        category: editing.category ?? "",
        sub_category: editing.sub_category ?? "",
        is_active: editing.is_active,
      });
    } else {
      setValues(EMPTY);
    }
  }, [editing, open]);

  const set = (key: keyof AsinFormValues, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <Modal open={open} title={editing ? "Edit ASIN" : "Add ASIN"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">ASIN</label>
          <Input
            className="w-full"
            value={values.asin}
            onChange={(e) => set("asin", e.target.value.toUpperCase())}
            placeholder="B0XXXXXXXX"
            required
            disabled={!!editing}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Product Name</label>
          <Input
            className="w-full"
            value={values.product_name}
            onChange={(e) => set("product_name", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Category</label>
            <Input
              className="w-full"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Sub Category</label>
            <Input
              className="w-full"
              value={values.sub_category}
              onChange={(e) => set("sub_category", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Tracking</label>
          <Select
            className="w-full"
            value={values.is_active ? "active" : "inactive"}
            onChange={(e) => set("is_active", e.target.value === "active")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Add ASIN"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
