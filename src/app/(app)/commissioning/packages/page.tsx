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

type PkgItem = { _id: string; packageNo: string; projectSnapshot: { name: string } | null; unitSnapshot: { unitNo: string } | null; systemSnapshot: { name: string } | null; subsystemName: string; punchItems: unknown[]; status: string };
const STATUS_LABELS: Record<string, string> = { planned: "계획", "in-progress": "진행중", "mc-complete": "MC 완료", "comm-complete": "시운전 완료", "handed-over": "인계 완료" };
const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { planned: "default", "in-progress": "info", "mc-complete": "warning", "comm-complete": "success", "handed-over": "success" };
const columns = [
  { key: "packageNo", label: "패키지번호" }, { key: "subsystem", label: "서브시스템" }, { key: "project", label: "프로젝트" },
  { key: "unit", label: "유닛" }, { key: "system", label: "계통" }, { key: "punch", label: "Punch" }, { key: "status", label: "상태" },
];

export default function CommPackagesPage() {
  const [items, setItems] = useState<PkgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();
  const router = useRouter();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/commissioning", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.packages); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/commissioning/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    packageNo: <span className="font-mono text-[color:var(--primary)]">{item.packageNo}</span>,
    subsystem: <span className="font-medium">{item.subsystemName}</span>,
    project: item.projectSnapshot?.name || "-", unit: item.unitSnapshot?.unitNo || "-",
    system: item.systemSnapshot?.name || "-",
    punch: <StatusBadge label={`${formatIntegerDisplay((item.punchItems || []).length)}건`} tone={(item.punchItems || []).length > 0 ? "warning" : "success"} />,
    status: <StatusBadge label={STATUS_LABELS[item.status] ?? item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Commissioning" title="시운전 패키지" description="시운전 패키지별 진행 상태, Punch 항목, Turnover를 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="commissioning-package.create" href="/commissioning/packages/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">패키지 등록</PermissionLink>} />
      <BulkActionTable title="시운전 패키지" description="MongoDB에서 조회한 시운전 패키지 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 패키지가 없습니다" }}
        onRowClick={(row) => router.push(`/commissioning/packages/${row.id}`)}
        bulkActions={[
          { key: "start", label: "작업 시작", tone: "info",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "commissioning-package.approve") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status === "planned"),
            confirmTitle: "선택한 패키지의 작업을 시작할까요?",
            onAction: (ids) => runBulk("start", ids, "작업 시작") },
          { key: "mc-complete", label: "MC 완료", tone: "warning",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "commissioning-package.approve") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status === "in-progress"),
            confirmTitle: "MC(Mechanical Completion) 완료 처리할까요?",
            onAction: (ids) => runBulk("mc-complete", ids, "MC 완료") },
          { key: "comm-complete", label: "시운전 완료", tone: "info",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "commissioning-package.approve") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status === "mc-complete"),
            confirmTitle: "시운전 완료 처리할까요?",
            onAction: (ids) => runBulk("comm-complete", ids, "시운전 완료") },
          { key: "handover", label: "인계", tone: "success",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "commissioning-package.approve") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status === "comm-complete"),
            confirmTitle: "선택한 패키지를 인계할까요?",
            onAction: (ids) => runBulk("handover", ids, "인계") },
        ]} />
    </>
  );
}
