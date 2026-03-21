"use client";

import { useEffect, useState } from "react";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendProjectIdToPath } from "@/lib/project-scope";

type WbsItem = {
  _id: string;
  code: string;
  name: string;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  unitSnapshot: {
    unitId: string;
    unitNo: string;
  } | null;
  systemSnapshot: {
    systemId: string;
    code: string;
    name: string;
  } | null;
  discipline: string;
  costCategory: string;
  status: string;
};

const columns = [
  { key: "code", label: "WBS코드" },
  { key: "name", label: "WBS명" },
  { key: "project", label: "프로젝트" },
  { key: "targetType", label: "연결수준" },
  { key: "target", label: "연결대상" },
  { key: "discipline", label: "전문분야" },
  { key: "costCategory", label: "원가항목" },
  { key: "status", label: "상태" },
];

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

export default function WbsPage() {
  const [items, setItems] = useState<WbsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentProject, currentProjectId } = useProjectSelection();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(appendProjectIdToPath("/api/projects/wbs", currentProjectId));
        const json = await res.json();

        if (!json.ok) {
          setError(json.message || "WBS 목록을 불러오지 못했습니다.");
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
    targetType: item.systemSnapshot?.systemId ? "시스템" : "유닛",
    target: item.systemSnapshot?.systemId
      ? `${item.unitSnapshot?.unitNo || "-"} · ${item.systemSnapshot.name || item.systemSnapshot.code || "-"}`
      : item.unitSnapshot?.unitNo || "-",
    discipline: item.discipline || "-",
    costCategory: item.costCategory === "indirect" ? "간접비" : "직접비",
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
        title="WBS 목록"
        description={
          currentProject
            ? `${currentProject.name} 프로젝트의 WBS를 관리합니다.`
            : "접근 가능한 프로젝트의 Work Breakdown Structure를 관리합니다."
        }
        meta={[
          { label: "Phase 2", tone: "info" },
          { label: "Team 2", tone: "success" },
        ]}
      />
      <DataTable
        title="WBS"
        description={
          currentProject
            ? `${currentProject.name} 프로젝트의 WBS 구조입니다.`
            : "접근 가능한 프로젝트의 WBS 구조입니다."
        }
        columns={columns}
        rows={rows}
        loading={loading}
        errorState={error ? { title: "WBS 조회 실패", description: error } : null}
        emptyState={{
          title: "등록된 WBS가 없습니다",
          description: currentProject
            ? "선택한 프로젝트에 등록된 WBS가 아직 없습니다."
            : "접근 가능한 프로젝트에 등록된 WBS가 아직 없습니다.",
        }}
      />
    </>
  );
}
