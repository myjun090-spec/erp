"use client";
import { useCallback, useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";

type ProjectSnapshot = { projectId: string; code: string; name: string; projectType: string } | null;
type ManufacturerSnapshot = { partyId?: string; manufacturerId?: string; code: string; name: string } | null;
type ModuleItem = {
  _id: string; moduleNo: string; moduleType: string; serialNo: string; status: string;
  projectSnapshot: ProjectSnapshot;
  systemSnapshot: { name: string } | null;
  manufacturerSnapshot: ManufacturerSnapshot;
};

const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = {
  planned: "default", fabricating: "info", testing: "warning", rework: "danger", shipped: "info", installed: "success",
};
const columns = [
  { key: "moduleNo", label: "모듈번호" }, { key: "type", label: "유형" }, { key: "serial", label: "S/N" },
  { key: "project", label: "프로젝트" }, { key: "system", label: "계통" }, { key: "manufacturer", label: "제작사" }, { key: "status", label: "상태" },
];

export default function ModulesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();

  // 제작 시작 모달 상태
  const [fabModal, setFabModal] = useState<{ open: boolean; targetIds: string[] }>({ open: false, targetIds: [] });
  const [fabDates, setFabDates] = useState({ plannedStartDate: "", plannedEndDate: "" });
  const [fabSaving, setFabSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(appendProjectIdToPath("/api/manufacturing", currentProjectId));
      const json = await res.json();
      if (json.ok) setItems(json.data.modules);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/manufacturing/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const handleFabConfirm = async () => {
    if (!fabDates.plannedStartDate || !fabDates.plannedEndDate) {
      pushToast({ title: "필수 입력", description: "계획 시작일과 종료일을 입력해 주세요.", tone: "warning" });
      return;
    }
    setFabSaving(true);
    try {
      const targets = items.filter(m => fabModal.targetIds.includes(m._id));
      const results = await Promise.all(targets.map(m =>
        fetch("/api/manufacturing-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleSnapshot: { moduleId: m._id, moduleNo: m.moduleNo, moduleType: m.moduleType, serialNo: m.serialNo },
            projectSnapshot: m.projectSnapshot ?? null,
            vendorSnapshot: m.manufacturerSnapshot ? {
              partyId: m.manufacturerSnapshot.partyId ?? m.manufacturerSnapshot.manufacturerId ?? "",
              code: m.manufacturerSnapshot.code,
              name: m.manufacturerSnapshot.name,
            } : null,
            plannedStartDate: fabDates.plannedStartDate,
            plannedEndDate: fabDates.plannedEndDate,
            quantity: 1,
            status: "in-progress",
          }),
        }).then(r => r.json())
      ));
      const successCount = results.filter(r => r.ok).length;
      const failCount = results.length - successCount;
      if (successCount > 0) pushToast({ title: "제작 시작", description: `${successCount}건 제작지시 등록 및 상태 변경 완료${failCount > 0 ? `, ${failCount}건 실패` : ""}`, tone: "success" });
      else pushToast({ title: "실패", description: "제작지시 등록에 실패했습니다.", tone: "warning" });
      setFabModal({ open: false, targetIds: [] });
      setFabDates({ plannedStartDate: "", plannedEndDate: "" });
      fetchData();
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setFabSaving(false);
    }
  };

  const rows = items.map(item => ({
    id: item._id,
    moduleNo: <span className="font-mono">{item.moduleNo}</span>,
    type: item.moduleType, serial: item.serialNo,
    project: item.projectSnapshot?.name || "-",
    system: item.systemSnapshot?.name || "-",
    manufacturer: item.manufacturerSnapshot?.name || "-",
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="모듈 목록" description="모듈 제작 현황과 시리얼 번호를 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="module.create" href="/manufacturing/modules/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">모듈 등록</PermissionLink>} />

      <BulkActionTable title="모듈" description="MongoDB에서 조회한 모듈 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 모듈이 없습니다" }}
        onRowClick={(row) => router.push(`/manufacturing/modules/${String(row.id)}`)}
        getRowAriaLabel={(row) => `모듈 ${String(row.moduleNo)} 상세 보기`}
        bulkActions={[
          {
            key: "start-fab", label: "제작 시작", tone: "info",
            isVisible: () => canAccessAction(viewerPermissions, "manufacturing-order.create"),
            isDisabled: (ids) => ids.some(id => {
              const item = items.find(m => m._id === id);
              return item ? !["planned", "rework"].includes(item.status) : false;
            }),
            disabledReason: "계획 또는 재작업 상태의 모듈만 제작 시작할 수 있습니다.",
            requiresConfirm: false,
            onAction: (ids) => { setFabDates({ plannedStartDate: "", plannedEndDate: "" }); setFabModal({ open: true, targetIds: ids }); },
          },
          {
            key: "start-testing", label: "검수 시작", tone: "warning",
            isVisible: () => canAccessAction(viewerPermissions, "module.update"),
            isDisabled: (ids) => ids.some(id => {
              const item = items.find(m => m._id === id);
              return item ? item.status !== "fabricating" : false;
            }),
            disabledReason: "제작중 상태의 모듈만 검수 시작할 수 있습니다.",
            onAction: (ids) => runBulk("start-testing", ids, "검수시작"),
          },
          {
            key: "ship", label: "출하 처리", tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "module.update"),
            isDisabled: (ids) => ids.some(id => {
              const item = items.find(m => m._id === id);
              return item ? item.status !== "testing" : false;
            }),
            disabledReason: "검수 중 상태의 모듈만 출하 처리할 수 있습니다.",
            onAction: (ids) => runBulk("ship", ids, "출하"),
          },
        ]} />

      {/* 제작 시작 날짜 입력 모달 */}
      {fabModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFabModal({ open: false, targetIds: [] })}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-1 text-base font-semibold text-[color:var(--text)]">제작 시작</h2>
            <p className="mb-5 text-sm text-[color:var(--text-muted)]">
              {fabModal.targetIds.length}개 모듈의 제작지시를 등록합니다.
            </p>
            <div className="grid gap-4">
              <DatePicker label="계획 시작일" required value={fabDates.plannedStartDate} onChange={v => setFabDates(prev => ({ ...prev, plannedStartDate: v }))} />
              <DatePicker label="계획 종료일" required value={fabDates.plannedEndDate} onChange={v => setFabDates(prev => ({ ...prev, plannedEndDate: v }))} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setFabModal({ open: false, targetIds: [] })} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
                취소
              </button>
              <button onClick={handleFabConfirm} disabled={fabSaving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {fabSaving ? "처리 중..." : "제작 시작"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
