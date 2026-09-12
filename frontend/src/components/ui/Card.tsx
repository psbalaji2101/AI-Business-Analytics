import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { InfoTooltip } from "./InfoTooltip";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  className,
  embedded = false,
  description,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  className?: string;
  embedded?: boolean;
  description?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {label}
            </p>
            {description && <InfoTooltip label={label} description={description} />}
          </div>
          <p className="mt-2 text-2xl font-bold text-[var(--text)]">{value}</p>
          {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
        </div>
        {icon && (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: accent ?? "rgba(109,94,252,0.15)", color: "var(--accent)" }}
          >
            {icon}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className={cn("bg-[var(--panel)] p-5", className)}>{content}</div>;
  }

  return <Card className={cn("p-5", className)}>{content}</Card>;
}
