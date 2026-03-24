"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { canCancelArIssue, canCollectAr, canIssueAr } from "@/lib/ar-status";
import { useFacilitySelection } from "@/components/layout/facility-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type ArItem = {
  _id: string;
  invoiceNo: string;
  customerSnapshot: { name: string } | null;
  projectSnapshot: { name: string } | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
  status: string;
  collectionSummary?: {
    receivedAmount?: number;
    remainingAmount?: number;
  } | null;
};
const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { draft: "default", issued: "info", "partial-received": "warning", received: "success", overdue: "danger" };
const columns = [
  { key: "invoiceNo", label: "청구번호" }, { key: "customer", label: "고객" }, { key: "project", label: "프로젝트" },
  { key: "invoiceDate", label: "청구일" }, { key: "dueDate", label: "만기일" }, { key: "amount", label: "총액", align: "right" as const }, { key: "receivedAmount", label: "수금액", align: "right" as const }, { key: "remainingAmount", label: "잔액", align: "right" as const }, { key: "status", label: "상태" },
];

export default function ArInvoicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentFacilityId } = useFacilitySelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendFacilityIdToPath("/api/finance", currentFacilityId)); const json = await res.json(); if (json.ok) setItems(json.data.arInvoices); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentFacilityId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (
    action: string,
    targetIds: string[],
    label: string,
    reason?: string,
  ) => {
    const res = await fetch("/api/finance/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds, reason }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const itemById = new Map(items.map((item) => [item._id, item]));

  const rows = items.map(item => ({
    id: item._id,
    invoiceNo: <span className="font-mono text-[color:var(--primary)]">{item.invoiceNo}</span>,
    customer: item.customerSnapshot?.name || "-", project: item.projectSnapshot?.name || "-",
    invoiceDate: item.invoiceDate, dueDate: item.dueDate,
    amount: <span className="font-mono">₩ {item.totalAmount?.toLocaleString() || "0"}</span>,
    receivedAmount: <span className="font-mono">₩ {Number(item.collectionSummary?.receivedAmount || 0).toLocaleString()}</span>,
    remainingAmount: <span className="font-mono">₩ {Number(item.collectionSummary?.remainingAmount || 0).toLocaleString()}</span>,
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Finance" title="매출전표 (AR)" description="기성청구와 수금 현황을 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="ar.create" href="/finance/ar/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">AR 등록</PermissionLink>} />
      <BulkActionTable title="AR" description="MongoDB에서 조회한 매출전표 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)}
        onRowClick={(_, index) => {
          const target = items[index];
          if (!target) return;
          router.push(`/finance/ar/${target._id}`);
        }}
        getRowAriaLabel={(_, index) => {
          const target = items[index];
          return target ? `${target.invoiceNo} 상세 보기` : "매출전표 상세 보기";
        }}
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 매출전표가 없습니다" }}
        bulkActions={[
          {
            key: "issue",
            label: "발행",
            tone: "info",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ar.issue") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canIssueAr(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("issue", ids, "발행"),
          },
          {
            key: "cancel-issue",
            label: "발행 취소",
            tone: "warning",
            confirmTitle: "선택한 AR 발행을 취소할까요?",
            confirmDescription:
              "발행 취소 시 해당 청구금액만큼 계약의 남은 청구 가능 금액이 복원됩니다. 수금 이력이 없는 발행 건만 취소할 수 있습니다.",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ar.cancel-issue") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) =>
                canCancelArIssue(
                  itemById.get(id)?.status,
                  itemById.get(id)?.collectionSummary?.receivedAmount,
                ),
              ),
            onAction: async (ids) => {
              const reason = window.prompt("발행 취소 사유를 입력해 주세요.");
              if (!reason || !reason.trim()) {
                pushToast({
                  title: "발행 취소 취소됨",
                  description: "취소 사유를 입력해야 발행 취소할 수 있습니다.",
                  tone: "warning",
                });
                return;
              }
              await runBulk("cancel-issue", ids, "발행 취소", reason);
            },
          },
          {
            key: "collect",
            label: "수금 처리",
            tone: "success",
            confirmTitle: "선택한 AR를 전액 수금 처리할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ar.collect") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canCollectAr(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("collect", ids, "수금"),
          },
        ]} />
    </>
  );
}
