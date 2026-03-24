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
import { canApproveAp, canCancelApApproval, canPayAp } from "@/lib/ap-status";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type ApItem = {
  _id: string;
  invoiceNo: string;
  vendorSnapshot: { name: string } | null;
  projectSnapshot: { name: string } | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentSummary?: {
    paidAmount?: number;
    remainingAmount?: number;
  } | null;
};
const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { pending: "warning", approved: "info", "partial-paid": "warning", paid: "success", overdue: "danger" };
const columns = [
  { key: "invoiceNo", label: "송장번호" }, { key: "vendor", label: "공급업체" }, { key: "project", label: "프로젝트" },
  { key: "invoiceDate", label: "송장일" }, { key: "dueDate", label: "만기일" }, { key: "amount", label: "총액", align: "right" as const },
  { key: "paidAmount", label: "지급액", align: "right" as const }, { key: "remainingAmount", label: "잔액", align: "right" as const }, { key: "status", label: "상태" },
];

export default function ApInvoicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentFacilityId } = useFacilitySelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendFacilityIdToPath("/api/finance", currentFacilityId)); const json = await res.json(); if (json.ok) setItems(json.data.apInvoices); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
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
    invoiceNo: <span className="font-mono text-[color:var(--primary)]">{item.invoiceNo}</span>,
    vendor: item.vendorSnapshot?.name || "-", project: item.projectSnapshot?.name || "-",
    invoiceDate: item.invoiceDate, dueDate: item.dueDate,
    amount: <span className="font-mono">₩ {item.totalAmount?.toLocaleString() || "0"}</span>,
    paidAmount: (
      <span className="font-mono">
        ₩ {Number(item.paymentSummary?.paidAmount || 0).toLocaleString()}
      </span>
    ),
    remainingAmount: (
      <span className="font-mono">
        ₩ {Number(item.paymentSummary?.remainingAmount || 0).toLocaleString()}
      </span>
    ),
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Finance" title="매입전표 (AP)" description="매입채무를 관리합니다. 지급 현황과 연체 상태를 추적합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="ap.create" href="/finance/ap/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">AP 등록</PermissionLink>} />
      <BulkActionTable title="AP" description="MongoDB에서 조회한 매입전표 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)}
        onRowClick={(_, index) => {
          const target = items[index];
          if (!target) {
            return;
          }
          router.push(`/finance/ap/${target._id}`);
        }}
        getRowAriaLabel={(_, index) => {
          const target = items[index];
          if (!target) {
            return "매입전표 상세 보기";
          }
          return `${target.invoiceNo || "매입전표"} 상세 보기`;
        }}
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 매입전표가 없습니다" }}
        bulkActions={[
          {
            key: "approve",
            label: "일괄 승인",
            tone: "success",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ap.approve") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canApproveAp(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("approve-ap", ids, "승인"),
          },
          {
            key: "pay",
            label: "지급 처리",
            tone: "info",
            confirmTitle: "선택한 AP를 지급 처리할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ap.pay") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canPayAp(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("pay", ids, "지급"),
          },
          {
            key: "cancel-approval",
            label: "승인 취소",
            tone: "warning",
            confirmTitle: "선택한 AP 승인을 취소할까요?",
            confirmDescription:
              "상태가 대기로 돌아가고, AP 승인으로 자동 생성된 draft 전표도 함께 정리합니다.",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "ap.cancel-approval") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => canCancelApApproval(itemById.get(id)?.status)),
            onAction: (ids) => runBulk("cancel-ap-approval", ids, "승인 취소"),
          },
        ]} />
    </>
  );
}
