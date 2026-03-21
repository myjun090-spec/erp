"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StatusBadge } from "@/components/ui/status-badge";

type ToastTone = "default" | "info" | "success" | "warning" | "danger";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (input: {
    title: string;
    description?: string;
    tone?: ToastTone;
  }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(input: {
    title: string;
    description?: string;
    tone?: ToastTone;
  }) {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    setToasts((current) => [
      ...current,
      {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "info",
      },
    ]);

    window.setTimeout(() => dismissToast(id), 3600);
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed right-6 top-24 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[color:var(--text)]">
                  {toast.title}
                </div>
                {toast.description ? (
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <StatusBadge label={toast.tone} tone={toast.tone} />
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="mt-3 text-xs font-semibold text-[color:var(--primary)]"
            >
              닫기
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
