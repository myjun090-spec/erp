"use client";

import { useEffect, useState } from "react";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendProjectIdToPath } from "@/lib/project-scope";

type SiteItem = {
  _id: string;
  code: string;
  name: string;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  country: string;
  siteManagerSnapshot: {
    displayName: string;
  } | null;
  status: string;
};

const columns = [
  { key: "code", label: "현장코드" },
  { key: "name", label: "현장명" },
  { key: "project", label: "프로젝트" },
  { key: "country", label: "국가" },
  { key: "manager", label: "현장책임자" },
  { key: "status", label: "상태" },
];

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

export default function SitesPage() {
  const [items, setItems] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentProject, currentProjectId } = useProjectSelection();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(appendProjectIdToPath("/api/projects/sites", currentProjectId));
        const json = await res.json();

        if (!json.ok) {
          setError(json.message || "현장 목록을 불러오지 못했습니다.");
          return;
        }

        setItems(json.data.items ?? []);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [currentProjectId]);

  const rows = items.map((item) => ({
    id: item._id,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code || "-"}</span>,
    name: <span className="font-medium">{item.name || "-"}</span>,
    project: item.projectSnapshot ? (
      <div>
        <div className="font-medium text-[color:var(--text)]">{item.projectSnapshot.name || "-"}</div>
        <div className="font-mono text-xs text-[color:var(--text-muted)]">
          {item.projectSnapshot.code || "-"}
        </div>
      </div>
    ) : (
      "-"
    ),
    country: item.country || "-",
    manager: item.siteManagerSnapshot?.displayName || "-",
    status: (
      <StatusBadge
        label={item.status || "active"}
        tone={statusTone[item.status || "active"] || "success"}
      />
    ),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="현장 목록"
        description={
          currentProject
            ? `${currentProject.name} 프로젝트의 현장을 관리합니다.`
            : "프로젝트별 현장을 관리합니다. 현장 하위의 유닛과 시스템 구조를 추적합니다."
        }
        meta={[
          { label: "Phase 2", tone: "info" },
          { label: "Team 2", tone: "success" },
        ]}
      />
      <DataTable
        title="현장"
        description={
          currentProject
            ? `${currentProject.name} 프로젝트의 현장 현황입니다.`
            : "접근 가능한 프로젝트 기준의 전체 현장 현황입니다."
        }
        columns={columns}
        rows={rows}
        loading={loading}
        errorState={error ? { title: "현장 조회 실패", description: error } : null}
        emptyState={{
          title: "등록된 현장이 없습니다",
          description: currentProject
            ? "선택한 프로젝트에 등록된 현장이 아직 없습니다."
            : "접근 가능한 프로젝트에 등록된 현장이 아직 없습니다.",
        }}
      />
    </>
  );
}
