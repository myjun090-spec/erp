"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";

type PlanItem = {
  _id: string;
  planNo: string;
  clientSnapshot: { name: string } | null;
  planDate: string;
  startDate: string;
  endDate: string;
  status: string;
};

const columns = [
  { key: "planNo", label: "계획번호" },
  { key: "clientName", label: "이용자" },
  { key: "planDate", label: "작성일" },
  { key: "startDate", label: "시작일" },
  { key: "endDate", label: "종료일" },
  { key: "status", label: "상태" },
];

const statusToneMap: Record<string, "success" | "default" | "warning" | "info" | "danger"> = {
  draft: "default",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  "in-progress": "info",
  completed: "success",
  terminated: "warning",
};

export default function PlansPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/case-plans");
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "사례계획 목록을 불러오지 못했습니다.");
        return;
      }
      setItems(json.data.items);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const rows = items.map((item) => ({
    id: item._id,
    planNo: <span className="font-mono text-[color:var(--primary)]">{item.planNo}</span>,
    clientName: <span className="font-medium">{item.clientSnapshot?.name || "-"}</span>,
    planDate: item.planDate || "-",
    startDate: item.startDate || "-",
    endDate: item.endDate || "-",
    status: (
      <StatusBadge
        label={item.status}
        tone={statusToneMap[item.status] ?? "default"}
      />
    ),
  }));

  const handleBulkAction = async (action: string, targetIds: string[]) => {
    try {
      const res = await fetch("/api/case-plans/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: "처리 실패",
          description: json.message || "대량 작업에 실패했습니다.",
          tone: "warning",
        });
        return;
      }
      pushToast({
        title: "처리 완료",
        description: `${json.affectedCount}건이 처리되었습니다.`,
        tone: "success",
      });
      void fetchData();
    } catch {
      pushToast({
        title: "처리 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="사례계획"
        title="사례계획 목록"
        description="사례계획을 관리합니다."
        actions={
          <PermissionLink
            permission="case-plan.create"
            href="/client-case/plans/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            사례계획 등록
          </PermissionLink>
        }
      />
      <BulkActionTable
        title="사례계획"
        description="사례계획 기록입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/client-case/plans/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.id)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "사례계획 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 사례계획이 없습니다" }}
        bulkActions={[
          {
            key: "submit",
            label: "제출",
            tone: "info",
            confirmTitle: "선택한 사례계획을 제출할까요?",
            confirmDescription: "선택한 사례계획의 상태를 제출로 변경합니다.",
            confirmLabel: "제출",
            onAction: (ids) => handleBulkAction("submit", ids),
          },
          {
            key: "approve",
            label: "승인",
            tone: "success",
            confirmTitle: "선택한 사례계획을 승인할까요?",
            confirmDescription: "선택한 사례계획을 승인합니다.",
            confirmLabel: "승인",
            onAction: (ids) => handleBulkAction("approve", ids),
          },
          {
            key: "reject",
            label: "반려",
            tone: "danger",
            confirmTitle: "선택한 사례계획을 반려할까요?",
            confirmDescription: "선택한 사례계획을 반려합니다.",
            confirmLabel: "반려",
            onAction: (ids) => handleBulkAction("reject", ids),
          },
          {
            key: "complete",
            label: "완료",
            tone: "success",
            confirmTitle: "선택한 사례계획을 완료할까요?",
            confirmDescription: "선택한 사례계획을 완료 처리합니다.",
            confirmLabel: "완료",
            onAction: (ids) => handleBulkAction("complete", ids),
          },
          {
            key: "terminate",
            label: "종료",
            tone: "warning",
            confirmTitle: "선택한 사례계획을 종료할까요?",
            confirmDescription: "선택한 사례계획을 종료합니다.",
            confirmLabel: "종료",
            onAction: (ids) => handleBulkAction("terminate", ids),
          },
        ]}
      />
    </>
  );
}
