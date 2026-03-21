"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";

type OrderItem = { _id: string; orderNo: string; projectSnapshot: { name: string } | null; moduleSnapshot: { moduleNo: string } | null; vendorSnapshot: { name: string } | null; plannedStartDate: string; plannedEndDate: string; status: string };
const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { planned: "default", "in-progress": "info", "on-hold": "warning", completed: "success" };
const columns = [
  { key: "orderNo", label: "지시번호" }, { key: "module", label: "대상 모듈" }, { key: "vendor", label: "제작사" },
  { key: "project", label: "프로젝트" }, { key: "planned", label: "계획기간" }, { key: "status", label: "상태" },
];

export default function ManufacturingOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/manufacturing", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.orders.filter((o: OrderItem) => o.status === "in-progress")); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/manufacturing/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    orderNo: <span className="font-mono font-medium text-[color:var(--text)]">{item.orderNo}</span>,
    module: item.moduleSnapshot?.moduleNo || "-", vendor: item.vendorSnapshot?.name || "-",
    project: item.projectSnapshot?.name || "-",
    planned: `${item.plannedStartDate?.substring(0,7) || ""} ~ ${item.plannedEndDate?.substring(0,7) || ""}`,
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="제작지시 목록" description="모듈 목록에서 제작 시작 시 자동 등록됩니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<Link href="/manufacturing/modules" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">모듈 목록으로</Link>} />
      <BulkActionTable title="제작지시" description="MongoDB에서 조회한 제작지시 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 제작지시가 없습니다" }}
        onRowClick={(row) => router.push(`/manufacturing/orders/${String(row.id)}`)}
        getRowAriaLabel={(row) => `제작지시 ${String(row.orderNo)} 상세 보기`}
        bulkActions={[
          {
            key: "complete",
            label: "완료",
            tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "manufacturing-order.update"),
            onAction: (ids) => runBulk("complete-order", ids, "완료"),
          },
        ]} />
    </>
  );
}
