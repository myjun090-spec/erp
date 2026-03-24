"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useFacilitySelection } from "@/components/layout/facility-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  canCancelJournalEntrySubmit,
  canPostJournalEntry,
  canReverseJournalEntry,
  canSubmitJournalEntry,
  getJournalEntryStatusTone,
} from "@/lib/journal-entry-status";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type JEItem = { _id: string; voucherNo: string; journalType: string; journalDate: string; projectSnapshot: { name: string } | null; totalDebit: number; totalCredit: number; status: string };
const columns = [
  { key: "voucherNo", label: "전표번호" }, { key: "journalType", label: "유형" }, { key: "date", label: "일자" },
  { key: "project", label: "프로젝트" }, { key: "debit", label: "차변", align: "right" as const }, { key: "credit", label: "대변", align: "right" as const }, { key: "status", label: "상태" },
];

export default function JournalEntriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<JEItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentFacilityId } = useFacilitySelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendFacilityIdToPath("/api/finance", currentFacilityId)); const json = await res.json(); if (json.ok) setItems(json.data.journalEntries); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentFacilityId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/finance/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const itemById = new Map(items.map((item) => [item._id, item]));
  const rows = items.map(item => ({
    id: item._id,
    voucherNo: <span className="font-mono text-[color:var(--primary)]">{item.voucherNo}</span>,
    journalType: item.journalType, date: item.journalDate,
    project: item.projectSnapshot?.name || "-",
    debit: <span className="font-mono">₩ {item.totalDebit?.toLocaleString() || "0"}</span>,
    credit: <span className="font-mono">₩ {item.totalCredit?.toLocaleString() || "0"}</span>,
    status: <StatusBadge label={item.status} tone={getJournalEntryStatusTone(item.status)} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Finance" title="분개전표 목록" description="분개전표를 등록하고 확정/역분개 처리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="journal-entry.create" href="/finance/journal-entries/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">전표 등록</PermissionLink>} />
      <BulkActionTable title="분개전표" description="MongoDB에서 조회한 전표 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        onRowClick={(_, index) => {
          const target = items[index];
          if (!target) return;
          router.push(`/finance/journal-entries/${target._id}`);
        }}
        getRowAriaLabel={(_, index) => {
          const target = items[index];
          return target ? `${target.voucherNo} 상세 보기` : "전표 상세 보기";
        }}
        emptyState={{ title: "등록된 전표가 없습니다" }}
        bulkActions={[
          {
            key: "submit",
            label: "일괄 제출",
            tone: "info",
            confirmTitle: "선택한 전표를 제출할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "journal-entry.submit") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canSubmitJournalEntry(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("submit-journal-entry", ids, "전표 제출"),
          },
          {
            key: "cancel-submit",
            label: "제출 취소",
            tone: "warning",
            confirmTitle: "선택한 전표 제출을 취소할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "journal-entry.submit") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canCancelJournalEntrySubmit(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("cancel-journal-submit", ids, "제출 취소"),
          },
          { key: "post", label: "일괄 확정", tone: "success", confirmTitle: "선택한 전표를 확정(posting)할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "journal-entry.post") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canPostJournalEntry(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("post", ids, "전표 확정") },
          { key: "reverse", label: "역분개", tone: "danger", confirmTitle: "선택한 전표를 역분개 처리할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "journal-entry.reverse") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canReverseJournalEntry(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("reverse", ids, "역분개") },
        ]} />
    </>
  );
}
