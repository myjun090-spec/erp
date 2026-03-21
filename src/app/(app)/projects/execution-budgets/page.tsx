"use client";

import { useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useRouter } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getExecutionBudgetApprovalLabel,
  getExecutionBudgetApprovalTone,
} from "@/lib/execution-budget-approval";
import { appendProjectIdToPath } from "@/lib/project-scope";

type ExecutionBudgetItem = {
  _id: string;
  projectSnapshot: { name: string } | null;
  wbsSnapshot: { code: string; name: string } | null;
  version: string;
  totalAmount: number;
  currency: string;
  effectiveDate: string;
  approvalStatus: string;
  status: string;
  usageSummary?: {
    committedAmount: number;
    actualAmount: number;
  };
};

const columns = [
  { key: "wbs", label: "WBS" },
  { key: "version", label: "버전" },
  { key: "totalAmount", label: "총액", align: "right" as const },
  { key: "commitment", label: "발주 약정", align: "right" as const },
  { key: "actual", label: "실집행", align: "right" as const },
  { key: "currency", label: "통화" },
  { key: "effectiveDate", label: "적용일" },
  { key: "approval", label: "승인상태" },
  { key: "status", label: "상태" },
];

export default function ExecutionBudgetsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExecutionBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentProjectId } = useProjectSelection();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appendProjectIdToPath("/api/execution-budgets", currentProjectId));
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "실행예산 목록을 불러오지 못했습니다.");
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
    wbsValue: item.wbsSnapshot ? `${item.wbsSnapshot.name} (${item.wbsSnapshot.code})` : "-",
    wbs: <span className="font-medium text-[color:var(--primary)]">{item.wbsSnapshot ? `${item.wbsSnapshot.name} (${item.wbsSnapshot.code})` : "-"}</span>,
    version: item.version,
    totalAmount: <span className="font-mono">₩ {Number(item.totalAmount || 0).toLocaleString()}</span>,
    commitment: <span className="font-mono">₩ {Number(item.usageSummary?.committedAmount || 0).toLocaleString()}</span>,
    actual: <span className="font-mono">₩ {Number(item.usageSummary?.actualAmount || 0).toLocaleString()}</span>,
    currency: item.currency,
    effectiveDate: item.effectiveDate,
    approval: (
      <StatusBadge
        label={getExecutionBudgetApprovalLabel(item.approvalStatus)}
        tone={getExecutionBudgetApprovalTone(item.approvalStatus)}
      />
    ),
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="실행예산 목록"
        description="WBS별 실행예산을 등록하고 버전 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Team 2", tone: "success" },
        ]}
        actions={
          <PermissionLink permission="execution-budget.create" href="/projects/execution-budgets/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            실행예산 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="실행예산"
        description="WBS별 실행예산 현황입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => router.push(`/projects/execution-budgets/${String(row.id)}`)}
        getRowAriaLabel={(row) => `${String(row.wbsValue)} 실행예산 상세 열기`}
        loading={loading}
        errorState={error ? { title: "실행예산 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 실행예산이 없습니다" }}
      />
    </>
  );
}
