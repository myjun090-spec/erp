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

type OpportunityItem = {
  _id: string;
  opportunityNo: string;
  name: string;
  customerSnapshot: { name: string } | null;
  opportunityType: string;
  stage: string;
  expectedAmount: number;
  currency: string;
  expectedAwardDate: string;
  ownerUserSnapshot: { displayName: string; orgUnitName: string } | null;
  status: string;
};

const stageTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  lead: "default",
  qualified: "info",
  proposal: "info",
  negotiation: "warning",
  "closed-won": "success",
  "closed-lost": "danger",
};

const columns = [
  { key: "opportunityNo", label: "기회번호" },
  { key: "name", label: "기회명" },
  { key: "customer", label: "고객" },
  { key: "stage", label: "단계" },
  { key: "amount", label: "예상금액", align: "right" as const },
  { key: "awardDate", label: "예상수주일" },
  { key: "owner", label: "담당자" },
  { key: "status", label: "상태" },
];

export default function OpportunitiesPage() {
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities");
      const json = await res.json();
      if (json.ok) {
        setItems(json.data.items);
      } else {
        setError(json.message || "데이터를 불러오지 못했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulkAction = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/opportunities/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetIds }),
    });
    const json = await res.json();
    if (json.ok) {
      pushToast({
        title: label,
        description: `${formatIntegerDisplay(json.affectedCount)}건 처리 완료`,
        tone: "success",
      });
      fetchData();
    } else {
      pushToast({ title: "오류", description: json.message, tone: "warning" });
    }
  };

  const rows = items.map((item) => ({
    id: item._id,
    opportunityNoValue: item.opportunityNo,
    opportunityNo: <span className="font-mono text-[color:var(--primary)]">{item.opportunityNo}</span>,
    name: <span className="font-medium">{item.name}</span>,
    customer: item.customerSnapshot?.name || "-",
    stage: <StatusBadge label={item.stage} tone={stageTone[item.stage] || "default"} />,
    amount: <span className="font-mono">₩ {item.expectedAmount.toLocaleString()}</span>,
    awardDate: item.expectedAwardDate,
    owner: item.ownerUserSnapshot ? `${item.ownerUserSnapshot.displayName}` : "-",
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="사업기회 목록"
        description="사업기회를 등록하고 단계별 진행 현황을 관리합니다. 기회에서 계약까지의 전체 파이프라인을 추적합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Bulk Action", tone: "warning" },
        ]}
        actions={
          <PermissionLink permission="opportunity.create" href="/business-development/opportunities/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            사업기회 등록
          </PermissionLink>
        }
      />
      <BulkActionTable
        title="사업기회"
        description="MongoDB에서 조회한 사업기회 파이프라인입니다. 대량 단계 변경과 종료 처리를 지원합니다."
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) =>
          router.push(`/business-development/opportunities/${String(row.id)}`)
        }
        getRowAriaLabel={(row) =>
          `${String(row.opportunityNoValue)} 사업기회 상세 열기`
        }
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 사업기회가 없습니다", description: "새 사업기회를 등록해 주세요." }}
        bulkActions={[
          {
            key: "advance-stage",
            label: "다음 단계",
            tone: "info",
            isVisible: () => canAccessAction(viewerPermissions, "opportunity.update"),
            confirmTitle: "선택한 사업기회를 다음 단계로 이동할까요?",
            confirmDescription: "lead→qualified→proposal→negotiation→closed-won 순서로 이동합니다.",
            onAction: (ids) => runBulkAction("advance-stage", ids, "단계 이동"),
          },
          {
            key: "close-won",
            label: "수주 확정",
            tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "opportunity.update"),
            confirmTitle: "선택한 사업기회를 수주 확정 처리할까요?",
            confirmDescription: "closed-won 상태로 전환되며 계약 등록 대상이 됩니다.",
            onAction: (ids) => runBulkAction("close-won", ids, "수주 확정"),
          },
          {
            key: "close-lost",
            label: "실주 처리",
            tone: "danger",
            isVisible: () => canAccessAction(viewerPermissions, "opportunity.update"),
            confirmTitle: "선택한 사업기회를 실주 처리할까요?",
            confirmDescription: "closed-lost 상태로 전환됩니다. 이후 재활성이 가능합니다.",
            onAction: (ids) => runBulkAction("close-lost", ids, "실주 처리"),
          },
        ]}
      />
    </>
  );
}
