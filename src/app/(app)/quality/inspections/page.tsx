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

type InspItem = { _id: string; inspectionType: string; inspectionDate: string; result: string; holdPoint: boolean; projectSnapshot: { name: string } | null; systemSnapshot: { name: string } | null; status: string };
const resultTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { pass: "success", fail: "danger", conditional: "warning" };
const RESULT_LABELS: Record<string, string> = { pass: "합격", fail: "불합격", conditional: "조건부합격" };
const STATUS_LABELS: Record<string, string> = { pending: "대기", "in-progress": "진행중", completed: "완료", verified: "검증" };
const STATUS_TONE: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { pending: "default", "in-progress": "info", completed: "success", verified: "success" };
const INSPECTION_TYPES = ["외관검사", "치수검사", "비파괴검사", "수압시험", "기능시험", "전기검사"];
const columns = [
  { key: "type", label: "검사유형" }, { key: "date", label: "검사일" }, { key: "result", label: "결과" },
  { key: "hold", label: "Hold Point" }, { key: "project", label: "프로젝트" }, { key: "system", label: "계통" }, { key: "status", label: "상태" },
];

export default function InspectionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<InspItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterResult, setFilterResult] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const viewerPermissions = useViewerPermissions();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch(appendProjectIdToPath("/api/quality", currentProjectId)); const json = await res.json(); if (json.ok) setItems(json.data.inspections); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [currentProjectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/quality/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const filtered = items.filter(item =>
    (!filterType || item.inspectionType === filterType) &&
    (!filterResult || item.result === filterResult) &&
    (!filterStatus || item.status === filterStatus)
  );

  const rows = filtered.map(item => ({
    id: item._id,
    type: <span className="font-medium">{item.inspectionType}</span>,
    date: item.inspectionDate,
    result: <StatusBadge label={RESULT_LABELS[item.result] ?? item.result} tone={resultTone[item.result] || "default"} />,
    hold: item.holdPoint ? <StatusBadge label="지정" tone="warning" /> : <span className="text-[color:var(--text-muted)]">-</span>,
    project: item.projectSnapshot?.name || "-", system: item.systemSnapshot?.name || "-",
    status: <StatusBadge label={STATUS_LABELS[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Quality" title="검사 이력" description="검사 결과와 Hold Point 관리를 합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="inspection.create" href="/quality/inspections/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">검사 등록</PermissionLink>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 유형</option>
          {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 결과</option>
          <option value="pass">합격</option>
          <option value="fail">불합격</option>
          <option value="conditional">조건부합격</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="in-progress">진행중</option>
          <option value="completed">완료</option>
          <option value="verified">검증</option>
        </select>
      </div>
      <BulkActionTable title="검사" description="MongoDB에서 조회한 검사 이력입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "검사 이력이 없습니다" }}
        onRowClick={row => router.push(`/quality/inspections/${row.id}`)}
        bulkActions={[
          { key: "verify", label: "일괄 검증", tone: "info",
            isVisible: (ids) =>
              canAccessAction(viewerPermissions, "inspection.update") &&
              items.filter(i => ids.includes(i._id)).some(i => i.status === "completed"),
            onAction: (ids) => runBulk("verify", ids, "검증") },
        ]} />
    </>
  );
}
