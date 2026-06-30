import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-2)] border border-transparent",
  outline:
    "bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--panel-2)]",
  ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--panel-2)] border border-transparent",
  danger: "bg-transparent text-rose-400 border border-rose-500/30 hover:bg-rose-500/10",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({ variant = "primary", icon, className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]",
        className
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
