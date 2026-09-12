import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";

export function InfoTooltip({
  label,
  description,
  className,
  contentClassName,
}: {
  label: string;
  description: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const tooltipId = useId();

  return (
    <span className={cn("group relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={tooltipId}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--muted)] outline-none transition hover:bg-violet-500/10 hover:text-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--text)] px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--panel)] opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          contentClassName
        )}
      >
        {description}
      </span>
    </span>
  );
}
