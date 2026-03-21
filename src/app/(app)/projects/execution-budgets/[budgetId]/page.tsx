"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import {
  canApproveExecutionBudget,
  canRequestExecutionBudgetRevision,
  canRevokeExecutionBudgetApproval,
  canSubmitExecutionBudget,
  getExecutionBudgetApprovalLabel,
  getExecutionBudgetApprovalTone,
} from "@/lib/execution-budget-approval";
import { getExecutionBudgetCostCategoryLabel } from "@/lib/execution-budget-cost-categories";

type ExecutionBudgetDetail = {
  _id: string;
  projectSnapshot: { name: string } | null;
  wbsSnapshot: { code: string; name: string } | null;
  version: string;
  currency: string;
  totalAmount: number;
  approvalStatus: string;
  effectiveDate: string;
  status: string;
  usageSummary?: {
    committedAmount: number;
    apActualAmount: number;
    journalActualAmount: number;
    actualAmount: number;
  };
  costItems: Array<{ costCategory: string; description: string; quantity: number; unitPrice: number; amount: number }>;
};

export default function BudgetDetailPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { pushToast } = useToast();
  const [data, setData] = useState<ExecutionBudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/execution-budgets/${budgetId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "실행예산을 불러오지 못했습니다.");
        return;
      }
      setData(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [budgetId]);

  const runApprovalAction = async (
    action: "submit" | "approve" | "request-revision" | "revoke-approval",
    successTitle: string,
    successDescription: string,
  ) => {
    setStatusActionLoading(action);
    try {
      const res = await fetch("/api/execution-budgets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds: [budgetId] }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: `${successTitle} 실패`,
          description: json.message || "실행예산 상태를 변경하지 못했습니다.",
          tone: "warning",
        });
        return;
      }
      await load();
      pushToast({
        title: successTitle,
        description: successDescription,
        tone: "success",
      });
    } catch {
      pushToast({
        title: `${successTitle} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setStatusActionLoading(null);
    }
  };

  if (loading) return <StatePanel variant="loading" title="실행예산 로딩 중" description="실행예산 상세를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="실행예산 조회 실패" description={error || "데이터가 없습니다."} />;

  const allocatedAmount = data.costItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingAmount = Math.max(data.totalAmount - allocatedAmount, 0);

  const tabItems = [
    { value: "overview", label: "기본정보", caption: "실행예산 상세" },
    { value: "items", label: "원가항목", count: data.costItems.length, caption: "원가 항목 내역" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Projects · 실행예산"
        title={`${data.wbsSnapshot?.name || "-"} 실행예산`}
        description={`${data.projectSnapshot?.name || "-"} · ${data.wbsSnapshot?.code || "-"} · ${data.version}`}
        meta={[
          { label: getExecutionBudgetApprovalLabel(data.approvalStatus), tone: getExecutionBudgetApprovalTone(data.approvalStatus) },
          { label: data.status, tone: data.status === "active" ? "success" : "default" },
        ]}
        actions={
          <>
            <Link href="/projects/execution-budgets" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              목록으로
            </Link>
            {canSubmitExecutionBudget(data.approvalStatus) ? (
              <PermissionButton
                permission="execution-budget.update"
                type="button"
                onClick={() =>
                  void runApprovalAction(
                    "submit",
                    "실행예산 제출 완료",
                    "실행예산 승인상태가 제출로 변경되었습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--warning)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--warning)] disabled:opacity-60"
              >
                {statusActionLoading === "submit" ? "처리 중..." : "제출"}
              </PermissionButton>
            ) : null}
            {canApproveExecutionBudget(data.approvalStatus) ? (
              <PermissionButton
                permission="execution-budget.approve"
                type="button"
                onClick={() =>
                  void runApprovalAction(
                    "approve",
                    "실행예산 승인 완료",
                    "실행예산 승인상태가 승인으로 변경되었습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--success)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--success)] disabled:opacity-60"
              >
                {statusActionLoading === "approve" ? "처리 중..." : "승인"}
              </PermissionButton>
            ) : null}
            {canRequestExecutionBudgetRevision(data.approvalStatus) ? (
              <PermissionButton
                permission="execution-budget.approve"
                type="button"
                onClick={() =>
                  void runApprovalAction(
                    "request-revision",
                    "보완 요청 완료",
                    "실행예산 승인상태가 보완요청으로 변경되었습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                {statusActionLoading === "request-revision" ? "처리 중..." : "보완 요청"}
              </PermissionButton>
            ) : null}
            {canRevokeExecutionBudgetApproval(data.approvalStatus) ? (
              <PermissionButton
                permission="execution-budget.approve"
                type="button"
                onClick={() =>
                  void runApprovalAction(
                    "revoke-approval",
                    "승인 취소 완료",
                    "실행예산 승인상태가 초안으로 되돌아갔습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                {statusActionLoading === "revoke-approval" ? "처리 중..." : "승인 취소"}
              </PermissionButton>
            ) : null}
            <PermissionLink permission="execution-budget.update" href={`/projects/execution-budgets/${budgetId}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              수정
            </PermissionLink>
          </>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">예산 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailField label="프로젝트" value={data.projectSnapshot?.name || "-"} />
            <DetailField label="WBS" value={data.wbsSnapshot ? `${data.wbsSnapshot.code} ${data.wbsSnapshot.name}` : "-"} />
            <DetailField label="버전" value={data.version} />
            <DetailField label="적용일" value={data.effectiveDate} />
            <DetailField label="통화" value={data.currency} />
            <DetailField label="총 예산액" value={`₩ ${Number(data.totalAmount || 0).toLocaleString()}`} />
            <DetailField label="배정 합계" value={`₩ ${allocatedAmount.toLocaleString()}`} />
            <DetailField label="남은 예산" value={`₩ ${remainingAmount.toLocaleString()}`} />
            <DetailField label="발주 약정액" value={`₩ ${Number(data.usageSummary?.committedAmount || 0).toLocaleString()}`} />
            <DetailField label="AP 실집행" value={`₩ ${Number(data.usageSummary?.apActualAmount || 0).toLocaleString()}`} />
            <DetailField label="전표 실집행" value={`₩ ${Number(data.usageSummary?.journalActualAmount || 0).toLocaleString()}`} />
            <DetailField label="실집행 합계" value={`₩ ${Number(data.usageSummary?.actualAmount || 0).toLocaleString()}`} />
            <DetailField label="승인상태" value={<StatusBadge label={getExecutionBudgetApprovalLabel(data.approvalStatus)} tone={getExecutionBudgetApprovalTone(data.approvalStatus)} />} />
            <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : "default"} />} />
          </dl>
        </Panel>
      )}

      {activeTab === "items" && (
        <>
          <Panel className="mb-4 border-[rgba(29,122,252,0.18)] bg-[rgba(233,242,255,0.92)] p-4">
            <p className="text-sm font-medium text-[color:var(--primary)]">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold">
                !
              </span>
              이 화면은 조회 전용입니다. 원가항목 수정은 우측 상단의 <span className="font-semibold">수정</span> 버튼을 눌러 편집 화면에서 진행해 주세요.
            </p>
          </Panel>
          <DataTable
            title="원가항목"
            description="실행예산 원가 항목 내역입니다. 수정은 상단 수정 버튼으로 이동해 진행합니다."
            columns={[
              { key: "category", label: "원가항목" },
              { key: "description", label: "설명" },
              { key: "quantity", label: "수량", align: "right" },
              { key: "unitPrice", label: "단가", align: "right" },
              { key: "amount", label: "금액", align: "right" },
            ]}
            rows={data.costItems.map((item) => ({
              category: <span className="font-medium">{getExecutionBudgetCostCategoryLabel(item.costCategory)}</span>,
              description: item.description,
              quantity: <span className="font-mono">{item.quantity.toLocaleString()}</span>,
              unitPrice: <span className="font-mono">₩ {item.unitPrice.toLocaleString()}</span>,
              amount: <span className="font-mono">₩ {item.amount.toLocaleString()}</span>,
            }))}
          />
        </>
      )}
    </>
  );
}
