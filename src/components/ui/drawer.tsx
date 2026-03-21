"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[rgba(9,30,66,0.34)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,248,249,0.98))] shadow-[var(--shadow-panel)]",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[color:var(--border)] px-6 py-5">
          {eyebrow ? (
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--primary)]">
              {eyebrow}
            </div>
          ) : null}
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h2
                id={titleId}
                className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)]"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]"
                >
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              title="닫기"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-xl leading-none text-[color:var(--text-muted)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
            >
              ×
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <div className="border-t border-[color:var(--border)] px-6 py-5">
            <div className="flex flex-wrap justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
