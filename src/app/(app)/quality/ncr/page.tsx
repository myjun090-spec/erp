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
import { appendProjectIdToPath } from "@/lib/project-scope";

type NcrItem = { _id: string; ncrNo: string; severity: string; disposition: string; projectSnapshot: { name: string } | null; ownerUserSnapshot: { displayName: string } | null; dueDate: string; status: string };
const STATUS_LABELS: Record<string, string> = { open: "접수", investigating: "조사중", disposition: "처분중", closed: "종결" };
const STATUS_TONE: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { open: "info", investigating: "warning", disposition: "warning", closed: "success" };
const SEV_LABELS: Record<string, string> = { minor: "경미", major: "중대", critical: "치명" };
const SEV_TONE: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { minor: "default", major: "warning", critical: "danger" };
const DISPOSITION_LABELS: Record<string, string> = { rework: "재작업", repair: "수리", scrap: "폐기", "accept-as-is": "특채" };
const columns = [
  { key: "ncrNo", label: "NCR 번호" }, { key: "severity", label: "심각도" }, { key: "disposition", label: "처분" },
  { key: "project", label: "프로젝트" }, { key: "owner", label: "담당자" }, { key: "dueDate", label: "기한" }, { key: "status", label: "상태" },
];

export default function NcrsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NcrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/quality", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.ncrs); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/quality/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const filtered = items.filter(item =>
    (!filterSeverity || item.severity === filterSeverity) &&
    (!filterStatus || item.status === filterStatus)
  );

  const rows = filtered.map(item => ({
    id: item._id,
    ncrNo: <span className="font-mono font-medium">{item.ncrNo}</span>,
    severity: <StatusBadge label={SEV_LABELS[item.severity] ?? item.severity} tone={SEV_TONE[item.severity] || "default"} />,
    disposition: item.disposition ? (DISPOSITION_LABELS[item.disposition] ?? item.disposition) : "-",
    project: item.projectSnapshot?.name || "-",
    owner: item.ownerUserSnapshot?.displayName || "-",
    dueDate: item.dueDate || "-",
    status: <StatusBadge label={STATUS_LABELS[item.status] ?? item.status} tone={STATUS_TONE[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Quality" title="NCR/CAPA 목록" description="부적합보고서와 시정/예방 조치를 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="ncr.create" href="/quality/ncr/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">NCR 등록</PermissionLink>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 심각도</option>
          <option value="minor">경미</option>
          <option value="major">중대</option>
          <option value="critical">치명</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 상태</option>
          <option value="open">접수</option>
          <option value="investigating">조사중</option>
          <option value="disposition">처분중</option>
          <option value="closed">종결</option>
        </select>
      </div>
      <BulkActionTable title="NCR" description="MongoDB에서 조회한 NCR 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 NCR이 없습니다" }}
        onRowClick={row => router.push(`/quality/ncr/${row.id}`)}
        bulkActions={[
          { key: "close", label: "일괄 종결", tone: "success",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "ncr.update") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status !== "closed"),
            confirmTitle: "선택한 NCR을 종결할까요?",
            onAction: (ids) => runBulk("close-ncr", ids, "NCR 종결") },
        ]} />
    </>
  );
}
