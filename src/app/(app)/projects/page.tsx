"use client";
import { useCallback, useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";

type ProjectItem = { _id: string; code: string; name: string; projectType: string; customerSnapshot: { name: string } | null; startDate: string; endDate: string; currency: string; status: string };
const statusTone: Record<string, "default"|"info"|"success"|"warning"|"danger"> = { planning: "info", active: "success", "on-hold": "warning", completed: "default", cancelled: "danger" };
const columns = [
  { key: "code", label: "프로젝트코드" }, { key: "name", label: "프로젝트명" }, { key: "type", label: "유형" },
  { key: "customer", label: "고객" }, { key: "period", label: "기간" }, { key: "currency", label: "통화" }, { key: "status", label: "상태" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch("/api/projects"); const json = await res.json(); if (json.ok) setItems(json.data.items); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/projects/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    codeValue: item.code,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code}</span>,
    name: <span className="font-medium">{item.name}</span>,
    type: item.projectType,
    customer: item.customerSnapshot?.name || "-",
    period: `${item.startDate?.substring(0,7) || ""} ~ ${item.endDate?.substring(0,7) || ""}`,
    currency: item.currency,
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Projects" title="프로젝트 목록" description="프로젝트를 등록하고 현장, 유닛, 시스템, WBS 계층 구조를 관리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="project.create" href="/projects/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">프로젝트 등록</PermissionLink>} />
      <BulkActionTable title="프로젝트" description="MongoDB에서 조회한 프로젝트 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)}
        onRowClick={(row) => router.push(`/projects/${String(row.id)}`)}
        getRowAriaLabel={(row) => `${String(row.codeValue)} 프로젝트 상세 열기`}
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 프로젝트가 없습니다", description: "새 프로젝트를 등록해 주세요." }}
        bulkActions={[
          { key: "activate", label: "프로젝트 활성", tone: "success", confirmTitle: "선택한 프로젝트를 활성 상태로 전환할까요?",
            isVisible: () => canAccessAction(viewerPermissions, "project.update"),
            onAction: (ids) => runBulk("activate", ids, "활성 전환") },
          { key: "hold", label: "일시 중지", tone: "warning", confirmTitle: "선택한 프로젝트를 중지할까요?",
            isVisible: () => canAccessAction(viewerPermissions, "project.update"),
            onAction: (ids) => runBulk("hold", ids, "중지") },
        ]} />
    </>
  );
}
