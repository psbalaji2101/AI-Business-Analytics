import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface AsinOption {
  asin: string;
  product_name: string;
}

/** A dropdown with an embedded search box (combobox) for picking an ASIN. */
export function AsinCombo({
  options,
  value,
  onChange,
}: {
  options: AsinOption[];
  value?: string;
  onChange: (asin?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.find((o) => o.asin === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.asin.toLowerCase().includes(q) || o.product_name.toLowerCase().includes(q)
      )
    : options;

  const pick = (asin?: string) => {
    onChange(asin);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative min-w-[260px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-semibold">{selected.asin}</span>{" "}
              <span className="text-[var(--muted)]">— {selected.product_name}</span>
            </>
          ) : (
            <span className="text-[var(--muted)]">All ASINs</span>
          )}
        </span>
        <ChevronDown size={15} className="shrink-0 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-[min(460px,90vw)] rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-lg">
          <div className="relative border-b border-[var(--border)] p-2">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ASIN or product name…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] py-1.5 pl-8 pr-3 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => pick(undefined)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--panel-2)]"
              >
                <span className="text-[var(--muted)]">All ASINs</span>
                {!value && <Check size={14} className="text-[var(--accent)]" />}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.asin}>
                <button
                  type="button"
                  onClick={() => pick(o.asin)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--panel-2)]"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-[var(--text)]">{o.asin}</span>
                    <span className="ml-2 truncate text-[var(--muted)]">{o.product_name}</span>
                  </span>
                  {value === o.asin && (
                    <Check size={14} className="shrink-0 text-[var(--accent)]" />
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-[var(--muted)]">
                No matching ASINs.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
