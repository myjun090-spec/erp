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

type ItpItem = { _id: string; code: string; name: string; revisionNo: number; projectSnapshot: { name: string } | null; systemSnapshot: { name: string } | null; approvalStatus: string; status: string };
const APPROVAL_LABELS: Record<string, string> = { draft: "초안", review: "검토중", approved: "승인", rejected: "반려" };
const approvalTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { draft: "default", review: "warning", approved: "success", rejected: "danger" };
const columns = [
  { key: "code", label: "ITP 코드" }, { key: "name", label: "ITP 명" }, { key: "revision", label: "Rev." },
  { key: "project", label: "프로젝트" }, { key: "system", label: "계통" }, { key: "approval", label: "승인" }, { key: "status", label: "상태" },
];

export default function ItpsPage() {
  const [items, setItems] = useState<ItpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/quality", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.itps); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/quality/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code}</span>,
    name: <span className="font-medium">{item.name}</span>,
    revision: typeof item.revisionNo === "number" ? `Rev.${item.revisionNo}` : (item.revisionNo || "-"),
    project: item.projectSnapshot?.name || "-",
    system: item.systemSnapshot?.name || "-",
    approval: <StatusBadge label={APPROVAL_LABELS[item.approvalStatus] ?? item.approvalStatus} tone={approvalTone[item.approvalStatus] || "default"} />,
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Quality" title="ITP 목록" description="검사시험계획서를 관리합니다. 시험 항목, Hold Point, 승인 현황을 추적합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="itp.create" href="/quality/itps/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">ITP 등록</PermissionLink>} />
      <BulkActionTable title="ITP" description="MongoDB에서 조회한 ITP 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} onRowClick={row => router.push(`/quality/itps/${String(row.id)}`)}
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 ITP가 없습니다" }}
        bulkActions={[
          { key: "submit-review", label: "검토 요청", tone: "info",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "itp.update") &&
              items.filter(i => ids.includes(i._id)).some(i => i.approvalStatus === "draft"),
            onAction: (ids) => runBulk("submit-review", ids, "검토 요청") },
          { key: "approve", label: "승인", tone: "success",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "itp.update") &&
              items.filter(i => ids.includes(i._id)).some(i => i.approvalStatus === "review"),
            onAction: (ids) => runBulk("approve-itp", ids, "승인") },
          { key: "revoke", label: "승인 취소", tone: "danger",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "itp.update") &&
              items.filter(i => ids.includes(i._id)).some(i => i.approvalStatus === "approved"),
            onAction: (ids) => runBulk("revoke-itp", ids, "승인 취소") },
        ]} />
    </>
  );
}
