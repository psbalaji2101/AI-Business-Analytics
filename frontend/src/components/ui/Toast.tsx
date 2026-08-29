import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const value: ToastContextValue = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border p-3 shadow-lg ${
              t.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1 text-sm">{t.message}</span>
            <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Extracts a human-readable message from an axios error. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as { response?: { data?: { detail?: string } }; message?: string };
  if (e?.response?.data?.detail) return e.response.data.detail;
  if (e?.message === "Network Error") return "Cannot reach the server. Is the backend running?";
  return e?.message ?? fallback;
}
