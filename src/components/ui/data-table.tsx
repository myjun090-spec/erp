import { useId } from "react";
import { Panel } from "@/components/ui/panel";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/cn";
import { formatIntegerDisplay } from "@/lib/number-input";

type Column = {
  key: string;
  label: string;
  align?: "left" | "right";
};

type Row = Record<string, React.ReactNode>;

type DataTableProps = {
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  actions?: React.ReactNode;
  caption?: string;
  className?: string;
  loading?: boolean;
  densityLabel?: string;
  getRowKey?: (row: Row, index: number) => string;
  onRowClick?: (row: Row, index: number) => void;
  getRowAriaLabel?: (row: Row, index: number) => string;
  emptyState?: {
    title?: string;
    description?: string;
    action?: React.ReactNode;
  };
  errorState?: {
    title?: string;
    description?: string;
    action?: React.ReactNode;
  } | null;
};

export function DataTable({
  title,
  description,
  columns,
  rows,
  actions,
  caption,
  className,
  loading = false,
  densityLabel = "Dense Table",
  getRowKey,
  onRowClick,
  getRowAriaLabel,
  emptyState,
  errorState,
}: DataTableProps) {
  const captionId = useId();
  const hasError = Boolean(errorState);
  const tableCaption = caption ?? `${title}. ${description}`;

  return (
    <Panel className={cn("content-auto overflow-hidden", className)}>
      <div className="border-b border-[color:var(--border)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[color:var(--text)]">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--selected)] px-3 py-1 text-xs font-medium text-[color:var(--primary)]">
              <span>{densityLabel}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                {formatIntegerDisplay(rows.length)}
              </span>
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <StatePanel
          variant="loading"
          title={`${title} 로딩 중`}
          description="목록 데이터를 준비하고 있습니다. 조건과 요약 값은 유지한 채 결과만 새로 불러옵니다."
          className="m-4 sm:m-5"
        />
      ) : hasError ? (
        <StatePanel
          variant="error"
          title={errorState?.title ?? `${title} 불러오기에 실패했습니다`}
          description={
            errorState?.description ??
            "네트워크 또는 권한 상태를 확인한 뒤 다시 시도해 주세요."
          }
          action={errorState?.action}
          className="m-4 sm:m-5"
        />
      ) : rows.length === 0 ? (
        <StatePanel
          variant="empty"
          title={emptyState?.title ?? "데이터가 없습니다"}
          description={
            emptyState?.description ??
            "조건을 변경하거나 새로운 항목을 등록해 주세요."
          }
          action={emptyState?.action}
          className="m-4 sm:m-5"
        />
      ) : (
        <div
          className="overflow-x-auto"
          aria-busy={loading}
          aria-describedby={captionId}
        >
          <table className="min-w-full border-collapse text-sm">
            <caption id={captionId} className="sr-only">
              {tableCaption}
            </caption>
            <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`border-b border-[color:var(--border)] px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase sm:px-5 ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={getRowKey ? getRowKey(row, index) : `row-${index}`}
                  className={cn(
                    "border-b border-[color:var(--border)] last:border-b-0 hover:bg-[rgba(12,102,228,0.04)]",
                    onRowClick &&
                      "cursor-pointer focus-within:bg-[rgba(12,102,228,0.06)] hover:bg-[rgba(12,102,228,0.06)]",
                  )}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick ? getRowAriaLabel?.(row, index) : undefined}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row, index);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 align-top sm:px-5 ${
                        column.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
