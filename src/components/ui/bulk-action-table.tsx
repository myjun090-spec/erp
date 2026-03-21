"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

type BulkAction = {
  key: string;
  label: string;
  tone?: "default" | "info" | "success" | "warning" | "danger";
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  requiresConfirm?: boolean;
  isVisible?: (selectedIds: string[]) => boolean;
  isDisabled?: (selectedIds: string[]) => boolean;
  disabledReason?: string;
  onAction: (rowIds: string[]) => void | Promise<void>;
};

type BulkActionTableProps = {
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  bulkActions: BulkAction[];
  getRowKey: (row: Row, index: number) => string;
  onRowClick?: (row: Row, index: number) => void;
  getRowAriaLabel?: (row: Row, index: number) => string;
  caption?: string;
  className?: string;
  loading?: boolean;
  densityLabel?: string;
  selectionLabel?: string;
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

const actionToneClassNames: Record<NonNullable<BulkAction["tone"]>, string> = {
  default:
    "border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]",
  info: "border-[color:var(--primary)] bg-[color:var(--selected)] text-[color:var(--primary)] hover:bg-white",
  success:
    "border-[color:var(--success)] bg-[rgba(223,246,235,0.88)] text-[color:var(--success)] hover:bg-white",
  warning:
    "border-[color:var(--warning)] bg-[rgba(255,243,214,0.92)] text-[color:var(--warning)] hover:bg-white",
  danger:
    "border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] text-[color:var(--danger)] hover:bg-white",
};

export function BulkActionTable({
  title,
  description,
  columns,
  rows,
  bulkActions,
  getRowKey,
  onRowClick,
  getRowAriaLabel,
  caption,
  className,
  loading = false,
  densityLabel = "Dense Table",
  selectionLabel = "선택 항목",
  emptyState,
  errorState,
}: BulkActionTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captionId = useId();
  const hasError = Boolean(errorState);
  const tableCaption = caption ?? `${title}. ${description}`;
  const rowIds = rows.map((row, index) => getRowKey(row, index));
  const visibleSelectedIds = selectedIds.filter((rowId) => rowIds.includes(rowId));
  const selectedSet = new Set(visibleSelectedIds);
  const allSelected = rowIds.length > 0 && rowIds.every((rowId) => selectedSet.has(rowId));
  const selectedCount = visibleSelectedIds.length;
  const pendingAction =
    bulkActions.find((action) => action.key === pendingActionKey) ?? null;
  const visibleBulkActions = bulkActions.filter((action) =>
    action.isVisible ? action.isVisible(visibleSelectedIds) : true,
  );

  const resetSelection = () => setSelectedIds([]);

  const toggleAllRows = () => {
    setSelectedIds(allSelected ? [] : rowIds);
  };

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) =>
      current.includes(rowId)
        ? current.filter((value) => value !== rowId)
        : [...current, rowId],
    );
  };

  const runAction = async (action: BulkAction) => {
    if (visibleSelectedIds.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await action.onAction(visibleSelectedIds);
      setPendingActionKey(null);
      resetSelection();
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--selected)] px-3 py-1 text-xs font-medium text-[color:var(--primary)]">
            <span>{densityLabel}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
              {formatIntegerDisplay(rows.length)}
            </span>
          </div>
        </div>
        {selectedCount > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-[rgba(12,102,228,0.14)] bg-[rgba(233,242,255,0.8)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[color:var(--primary)]">
                {selectionLabel}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text)]">
                {formatIntegerDisplay(selectedCount)}건 선택됨. 대량 상태 변경과 승인 요청을 같은 패턴으로 처리합니다.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleBulkActions.map((action) => {
                const actionDisabled = submitting || (action.isDisabled ? action.isDisabled(visibleSelectedIds) : false);
                return (
                  <button
                    key={action.key}
                    type="button"
                    disabled={actionDisabled}
                    title={actionDisabled && action.disabledReason ? action.disabledReason : undefined}
                    onClick={() => {
                      if (actionDisabled) return;
                      if (action.requiresConfirm === false) {
                        void runAction(action);
                        return;
                      }
                      setPendingActionKey(action.key);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                      actionToneClassNames[action.tone ?? "default"],
                    )}
                  >
                    {action.label}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={submitting}
                onClick={resetSelection}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                선택 해제
              </button>
            </div>
          </div>
        ) : null}
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
        <div className="overflow-x-auto" aria-busy={loading} aria-describedby={captionId}>
          <table className="min-w-full border-collapse text-sm">
            <caption id={captionId} className="sr-only">
              {tableCaption}
            </caption>
            <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
              <tr>
                <th
                  scope="col"
                  className="w-12 border-b border-[color:var(--border)] px-4 py-3 text-left text-xs font-semibold tracking-[0.14em] uppercase sm:px-5"
                >
                  <input
                    type="checkbox"
                    aria-label="전체 행 선택"
                    checked={allSelected}
                    onChange={toggleAllRows}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--primary)]"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "border-b border-[color:var(--border)] px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase sm:px-5",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowId = getRowKey(row, index);
                const checked = selectedSet.has(rowId);

                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-b border-[color:var(--border)] last:border-b-0",
                      checked
                        ? "bg-[rgba(12,102,228,0.06)]"
                        : "hover:bg-[rgba(12,102,228,0.04)]",
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
                    <td className="px-4 py-3 align-top sm:px-5">
                      <input
                        type="checkbox"
                        aria-label={`${rowId} 선택`}
                        checked={checked}
                        onChange={() => toggleRow(rowId)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--primary)]"
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 align-top sm:px-5",
                          column.align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.confirmTitle ?? "선택한 항목을 처리할까요?"}
        description={
          pendingAction?.confirmDescription ??
          `${formatIntegerDisplay(selectedCount)}건에 대해 ${pendingAction?.label ?? "대량 작업"}을 실행합니다.`
        }
        confirmLabel={pendingAction?.confirmLabel ?? pendingAction?.label ?? "실행"}
        tone={pendingAction?.tone === "danger" ? "danger" : "info"}
        onClose={() => setPendingActionKey(null)}
        onConfirm={() => {
          if (!pendingAction) {
            return;
          }

          void runAction(pendingAction);
        }}
      />
    </Panel>
  );
}
