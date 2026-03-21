"use client";

import { useId, type ReactNode } from "react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

type FilterOption = {
  label: string;
  value: string;
};

type FilterField = {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
};

type FilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  onFilterChange?: (key: string, value: string) => void;
  summary?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "검색어 입력",
  filters = [],
  onFilterChange,
  summary,
  actions,
  className,
}: FilterBarProps) {
  const searchId = useId();
  const summaryId = useId();

  return (
    <Panel className={cn("content-auto p-4 sm:p-5", className)}>
      <div
        role="search"
        aria-describedby={summary ? summaryId : undefined}
        className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
      >
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="min-w-0 flex-1 space-y-2 lg:basis-[320px]">
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              검색
            </span>
            <input
              id={searchId}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
              aria-label="검색"
            />
          </label>
          {filters.map((filter, index) => {
            const selectId = `${searchId}-${filter.key}-${index}`;

            return (
              <label key={filter.key} className="min-w-[180px] flex-1 space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  {filter.label}
                </span>
                <select
                  id={selectId}
                  value={filter.value}
                  onChange={(event) =>
                    onFilterChange?.(filter.key, event.target.value)
                  }
                  className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                >
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between xl:min-w-fit xl:flex-nowrap xl:justify-end">
          {summary ? (
            <div
              id={summaryId}
              aria-live="polite"
              className="inline-flex min-h-10 items-center rounded-full bg-[color:var(--selected)] px-4 py-2 text-sm font-medium text-[color:var(--primary)]"
            >
              {summary}
            </div>
          ) : null}
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
