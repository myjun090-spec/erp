"use client";

import { useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendProjectIdToPath } from "@/lib/project-scope";

type RegulatoryItem = {
  _id: string;
  actionNo: string;
  projectSnapshot: { name: string } | null;
  regulator: string;
  actionType: string;
  subject: string;
  dueDate: string;
  ownerUserSnapshot: { displayName?: string; orgUnitName?: string } | null;
  status: string;
};

const TYPE_LABELS: Record<string, string> = {
  license: "인허가", inspection: "검사", report: "보고",
  submission: "제출", closure: "종결", query: "질의",
};

const columns = [
  { key: "actionNo", label: "대응번호" },
  { key: "project", label: "프로젝트" },
  { key: "regulator", label: "규제기관" },
  { key: "type", label: "대응유형" },
  { key: "subject", label: "주제" },
  { key: "dueDate", label: "기한" },
  { key: "owner", label: "담당자" },
  { key: "status", label: "상태" },
];

export default function RegulatoryPage() {
  const [items, setItems] = useState<RegulatoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentProjectId } = useProjectSelection();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appendProjectIdToPath("/api/regulatory", currentProjectId));
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "규제대응 목록을 불러오지 못했습니다.");
          return;
        }
        setItems(json.data.items);
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
    actionNo: <span className="font-mono text-[color:var(--primary)]">{item.actionNo}</span>,
    project: item.projectSnapshot?.name || "-",
    regulator: item.regulator,
    type: TYPE_LABELS[item.actionType] ?? item.actionType,
    subject: <span className="font-medium">{item.subject}</span>,
    dueDate: item.dueDate,
    owner: item.ownerUserSnapshot?.displayName || item.ownerUserSnapshot?.orgUnitName || "-",
    status: <StatusBadge label={item.status} tone={item.status === "open" ? "warning" : "success"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Commissioning"
        title="규제대응 목록"
        description="규제기관 대응 항목을 등록하고 기한과 진행 상태를 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Team 2", tone: "success" },
        ]}
        actions={
          <PermissionLink permission="regulatory-action.create" href="/commissioning/regulatory/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            규제대응 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="규제대응"
        description="규제기관 대응 현황입니다."
        columns={columns}
        rows={rows}
        loading={loading}
        errorState={error ? { title: "규제대응 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 규제대응이 없습니다" }}
        onRowClick={(row) => router.push(`/commissioning/regulatory/${row.id}`)}
      />
    </>
  );
}
