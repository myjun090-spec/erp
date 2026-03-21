"use client";

import { cn } from "@/lib/cn";
import { formatIntegerDisplay } from "@/lib/number-input";

export type TabItem = {
  value: string;
  label: string;
  count?: number;
  caption?: string;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="콘텐츠 전환"
      className={cn(
        "grid gap-3 rounded-[28px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.68)] p-2 md:grid-cols-2 2xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-[22px] border px-4 py-4 text-left transition",
              isActive
                ? "border-[color:var(--primary)] bg-[linear-gradient(135deg,rgba(12,102,228,0.12),rgba(233,242,255,0.95))] shadow-[var(--shadow-soft)]"
                : "border-transparent bg-[color:var(--surface)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-muted)]",
              item.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                {item.label}
              </div>
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase",
                    isActive
                      ? "bg-[color:var(--primary)] text-white"
                      : "bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]",
                  )}
                >
                  {formatIntegerDisplay(item.count)}
                </span>
              ) : null}
            </div>
            {item.caption ? (
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                {item.caption}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
