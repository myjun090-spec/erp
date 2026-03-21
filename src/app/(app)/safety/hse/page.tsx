"use client";
import { useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendProjectIdToPath } from "@/lib/project-scope";
import { INCIDENT_TYPE_OPTIONS, INCIDENT_TYPE_LABELS, SEVERITY_OPTIONS, SEVERITY_LABELS, SEVERITY_TONE, STATUS_LABELS, STATUS_TONE } from "./_shared";

type HseItem = {
  _id: string;
  incidentNo: string;
  incidentType: string;
  severity: string;
  title: string;
  occurredAt: string;
  siteSnapshot: { name: string } | null;
  status: string;
  ownerUserSnapshot: { displayName?: string; orgUnitName?: string } | null;
  projectSnapshot: { name: string } | null;
};

const columns = [
  { key: "incidentNo", label: "사고번호" },
  { key: "project", label: "프로젝트" },
  { key: "site", label: "현장" },
  { key: "type", label: "유형" },
  { key: "severity", label: "심각도" },
  { key: "occurredAt", label: "발생일" },
  { key: "owner", label: "담당자" },
  { key: "status", label: "상태" },
];

export default function HsePage() {
  const [items, setItems] = useState<HseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { currentProjectId } = useProjectSelection();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appendProjectIdToPath("/api/hse", currentProjectId));
        const json = await res.json();
        if (!json.ok) { setError(json.message || "목록을 불러오지 못했습니다."); return; }
        setItems(json.data.items);
      } catch { setError("네트워크 오류가 발생했습니다."); }
      finally { setLoading(false); }
    }
    void load();
  }, [currentProjectId]);

  const filtered = items.filter(item =>
    (!filterType || item.incidentType === filterType) &&
    (!filterSeverity || item.severity === filterSeverity) &&
    (!filterStatus || item.status === filterStatus)
  );

  const rows = filtered.map(item => ({
    id: item._id,
    incidentNo: <span className="font-mono text-[color:var(--primary)]">{item.incidentNo}</span>,
    project: item.projectSnapshot?.name || "-",
    site: item.siteSnapshot?.name || "-",
    type: INCIDENT_TYPE_LABELS[item.incidentType] ?? item.incidentType,
    severity: <StatusBadge label={SEVERITY_LABELS[item.severity] ?? item.severity} tone={SEVERITY_TONE[item.severity] ?? "default"} />,
    occurredAt: item.occurredAt || "-",
    owner: item.ownerUserSnapshot?.displayName || item.ownerUserSnapshot?.orgUnitName || "-",
    status: <StatusBadge label={STATUS_LABELS[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "warning"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Safety"
        title="HSE 사고 목록"
        description="안전사고와 아차사고를 기록하고 시정조치를 추적합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <PermissionLink permission="hse.create" href="/safety/hse/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            HSE 사고 등록
          </PermissionLink>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 유형</option>
          {INCIDENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 심각도</option>
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none">
          <option value="">전체 상태</option>
          <option value="open">접수</option>
          <option value="investigating">조사중</option>
          <option value="closed">종결</option>
        </select>
      </div>
      <DataTable
        title="HSE 사고"
        description="HSE 사고/아차사고 이력입니다."
        columns={columns}
        rows={rows}
        loading={loading}
        errorState={error ? { title: "HSE 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 사고가 없습니다" }}
        onRowClick={row => router.push(`/safety/hse/${row.id}`)}
      />
    </>
  );
}
