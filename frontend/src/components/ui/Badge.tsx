import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "green" | "red" | "amber" | "violet" | "gray";

const styles: Record<Variant, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  gray: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function Badge({
  children,
  variant = "gray",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
