"use client";
import { useCallback, useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
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

type ShipmentItem = {
  _id: string; shipmentNo: string; status: string;
  logisticsStatus: string; customsStatus: string;
  origin: string; destination: string;
  departureDate: string | null; arrivalDate: string | null;
  projectSnapshot: { name: string } | null;
  moduleSnapshots: { moduleNo: string }[] | null;
};

const logisticsTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planned: "default", booked: "default", preparing: "warning", "in-transit": "info", delivered: "success",
};
const customsTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  "n/a": "default", pending: "warning", cleared: "success",
};
const logisticsLabel: Record<string, string> = {
  planned: "계획", booked: "예약됨", preparing: "준비중", "in-transit": "운송중", delivered: "도착완료",
};
const customsLabel: Record<string, string> = {
  "n/a": "해당없음", pending: "통관중", cleared: "통관완료",
};

const columns = [
  { key: "shipmentNo", label: "운송번호" },
  { key: "project", label: "프로젝트" },
  { key: "modules", label: "대상 모듈" },
  { key: "route", label: "구간" },
  { key: "departure", label: "출발일" },
  { key: "arrival", label: "도착일" },
  { key: "logistics", label: "운송상태" },
  { key: "customs", label: "통관상태" },
];

export default function ShipmentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(appendProjectIdToPath("/api/shipments", currentProjectId));
      const json = await res.json();
      if (json.ok) setItems(json.data.items);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/shipments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    shipmentNo: <span className="font-mono font-medium">{item.shipmentNo}</span>,
    project: item.projectSnapshot?.name ?? "-",
    modules: item.moduleSnapshots?.map(m => m.moduleNo).join(", ") ?? "-",
    route: item.origin && item.destination ? `${item.origin} → ${item.destination}` : "-",
    departure: item.departureDate ?? "-",
    arrival: item.arrivalDate ?? "-",
    logistics: <StatusBadge label={logisticsLabel[item.logisticsStatus] ?? item.logisticsStatus} tone={logisticsTone[item.logisticsStatus] ?? "default"} />,
    customs: <StatusBadge label={customsLabel[item.customsStatus] ?? item.customsStatus} tone={customsTone[item.customsStatus] ?? "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="운송/통관 목록" description="모듈 운송과 통관 현황을 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="shipment.create" href="/manufacturing/shipments/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">운송 등록</PermissionLink>} />
      <BulkActionTable title="운송/통관" description="MongoDB에서 조회한 운송 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 운송이 없습니다" }}
        onRowClick={row => router.push(`/manufacturing/shipments/${String(row.id)}`)}
        getRowAriaLabel={row => `운송 ${String(row.shipmentNo)} 상세 보기`}
        bulkActions={[
          {
            key: "start-transit", label: "운송 시작", tone: "info",
            isVisible: () => canAccessAction(viewerPermissions, "shipment.approve"),
            isDisabled: ids => ids.some(id => { const i = items.find(s => s._id === id); return i ? !["planned", "booked", "preparing"].includes(i.logisticsStatus) : false; }),
            disabledReason: "계획/예약/준비중 상태의 운송만 시작할 수 있습니다.",
            onAction: ids => runBulk("start-transit", ids, "운송 시작"),
          },
          {
            key: "clear-customs", label: "통관 완료", tone: "warning",
            isVisible: () => canAccessAction(viewerPermissions, "shipment.approve"),
            isDisabled: ids => ids.some(id => { const i = items.find(s => s._id === id); return i ? i.customsStatus !== "pending" : false; }),
            disabledReason: "통관중 상태의 운송만 처리할 수 있습니다.",
            onAction: ids => runBulk("clear-customs", ids, "통관 완료"),
          },
          {
            key: "complete-delivery", label: "도착 완료", tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "shipment.approve"),
            isDisabled: ids => ids.some(id => { const i = items.find(s => s._id === id); return i ? i.logisticsStatus !== "in-transit" : false; }),
            disabledReason: "운송중 상태의 운송만 완료 처리할 수 있습니다.",
            onAction: ids => runBulk("complete-delivery", ids, "도착 완료"),
          },
        ]} />
    </>
  );
}
