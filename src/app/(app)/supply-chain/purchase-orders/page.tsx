"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import {
  canApprovePurchaseOrder,
  canCancelPurchaseOrderApproval,
  canRejectPurchaseOrder,
  canSubmitPurchaseOrder,
  getPurchaseOrderStatusTone,
} from "@/lib/purchase-order-status";
import { appendProjectIdToPath } from "@/lib/project-scope";

type POItem = { _id: string; poNo: string; projectSnapshot: { name: string } | null; vendorSnapshot: { name: string } | null; orderDate: string; dueDate: string; currency: string; totalAmount: number; status: string };
const columns = [
  { key: "poNo", label: "발주번호" }, { key: "vendor", label: "공급업체" }, { key: "project", label: "프로젝트" },
  { key: "orderDate", label: "발주일" }, { key: "amount", label: "금액", align: "right" as const }, { key: "status", label: "상태" },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const statusById = new Map(items.map((item) => [item._id, item.status]));
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/purchase-orders", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.items); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/purchase-orders/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const areAllSelected = (
    selectedIds: string[],
    matcher: (status: string) => boolean,
  ) =>
    selectedIds.length > 0 &&
    selectedIds.every((id) => matcher(statusById.get(id) ?? ""));

  const rows = items.map(item => ({
    id: item._id,
    poNoValue: item.poNo,
    poNo: <span className="font-mono text-[color:var(--primary)]">{item.poNo}</span>,
    vendor: item.vendorSnapshot?.name || "-",
    project: item.projectSnapshot?.name || "-",
    orderDate: item.orderDate,
    amount: <span className="font-mono">₩ {item.totalAmount?.toLocaleString() || "0"}</span>,
    status: <StatusBadge label={item.status} tone={getPurchaseOrderStatusTone(item.status)} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Supply Chain" title="발주 목록" description="발주서를 등록하고 입고, 검수, 지급 현황을 추적합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="purchase-order.create" href="/supply-chain/purchase-orders/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">발주 등록</PermissionLink>} />
      <BulkActionTable title="발주" description="MongoDB에서 조회한 발주 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        onRowClick={(row) => {
          router.push(`/supply-chain/purchase-orders/${row.id}`);
        }}
        getRowAriaLabel={(row) => `${row.poNoValue} 상세 보기`}
        emptyState={{ title: "등록된 발주가 없습니다", description: "새 발주를 등록해 주세요." }}
        bulkActions={[
          {
            key: "submit",
            label: "일괄 제출",
            tone: "info",
            confirmTitle: "선택한 발주를 제출할까요?",
            confirmDescription: "제출 후 승인 또는 반려 단계로 이동할 수 있습니다.",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "purchase-order.submit") &&
              areAllSelected(selectedIds, canSubmitPurchaseOrder),
            onAction: (ids) => runBulk("submit", ids, "제출"),
          },
          { key: "approve", label: "일괄 승인", tone: "success", confirmTitle: "선택한 발주를 승인할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "purchase-order.approve") &&
              areAllSelected(selectedIds, canApprovePurchaseOrder),
            onAction: (ids) => runBulk("approve", ids, "승인") },
          { key: "reject", label: "일괄 반려", tone: "danger", confirmTitle: "선택한 발주를 반려할까요?",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "purchase-order.reject") &&
              areAllSelected(selectedIds, canRejectPurchaseOrder),
            onAction: (ids) => runBulk("reject", ids, "반려") },
          {
            key: "cancel-approval",
            label: "승인 취소",
            tone: "warning",
            confirmTitle: "선택한 발주의 승인을 취소할까요?",
            confirmDescription: "승인이 취소되면 상태가 제출로 돌아가고 약정 반영 금액도 함께 되돌립니다.",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "purchase-order.cancel-approval") &&
              areAllSelected(selectedIds, canCancelPurchaseOrderApproval),
            onAction: (ids) => runBulk("cancel-approval", ids, "승인 취소"),
          },
        ]} />
    </>
  );
}
