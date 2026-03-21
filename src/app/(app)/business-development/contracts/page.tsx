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

type ContractItem = {
  _id: string;
  contractNo: string;
  contractType: string;
  title: string;
  customerSnapshot: { name: string } | null;
  startDate: string;
  endDate: string;
  contractAmount: number;
  currency: string;
  status: string;
};

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  draft: "default",
  review: "warning",
  active: "success",
  completed: "info",
  terminated: "danger",
  archived: "default",
};

const columns = [
  { key: "contractNo", label: "계약번호" },
  { key: "title", label: "계약명" },
  { key: "customer", label: "고객" },
  { key: "type", label: "유형" },
  { key: "amount", label: "계약금액", align: "right" as const },
  { key: "period", label: "계약기간" },
  { key: "status", label: "상태" },
];

export default function ContractsPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts");
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

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/contracts/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리 완료`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map((item) => ({
    id: item._id,
    contractNoValue: item.contractNo,
    contractNo: <span className="font-mono text-[color:var(--primary)]">{item.contractNo}</span>,
    title: <span className="font-medium">{item.title}</span>,
    customer: item.customerSnapshot?.name || "-",
    type: item.contractType,
    amount: <span className="font-mono">₩ {item.contractAmount.toLocaleString()}</span>,
    period: `${item.startDate?.substring(0, 7) || ""} ~ ${item.endDate?.substring(0, 7) || ""}`,
    status: <StatusBadge label={item.status} tone={statusTone[item.status] || "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="계약 목록"
        description="체결된 계약과 변경계약을 관리합니다. 계약 금액, 기간, 상태를 추적합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Bulk Action", tone: "warning" },
        ]}
        actions={
          <PermissionLink permission="contract.create" href="/business-development/contracts/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            계약 등록
          </PermissionLink>
        }
      />
      <BulkActionTable
        title="계약"
        description="MongoDB에서 조회한 계약 목록입니다. 상태 변경과 일괄 검토 요청을 지원합니다."
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) =>
          router.push(`/business-development/contracts/${String(row.id)}`)
        }
        getRowAriaLabel={(row) =>
          `${String(row.contractNoValue)} 계약 상세 열기`
        }
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 계약이 없습니다", description: "새 계약을 등록해 주세요." }}
        bulkActions={[
          {
            key: "request-review",
            label: "검토 요청",
            tone: "info",
            isVisible: () => canAccessAction(viewerPermissions, "contract.approve"),
            confirmTitle: "선택한 계약을 검토 요청할까요?",
            confirmDescription: "계약 상태를 review로 전환합니다.",
            onAction: (ids) => runBulk("request-review", ids, "검토 요청"),
          },
          {
            key: "activate",
            label: "계약 활성",
            tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "contract.approve"),
            confirmTitle: "선택한 계약을 활성 상태로 전환할까요?",
            confirmDescription: "사업수행 가능 상태로 전환됩니다.",
            onAction: (ids) => runBulk("activate", ids, "계약 활성"),
          },
          {
            key: "archive",
            label: "보관",
            tone: "danger",
            isVisible: () => canAccessAction(viewerPermissions, "contract.archive"),
            confirmTitle: "선택한 계약을 보관할까요?",
            confirmDescription: "보관된 계약은 계약 목록에서 제외되지만 상세와 이력은 유지됩니다.",
            onAction: (ids) => runBulk("archive", ids, "계약 보관"),
          },
        ]}
      />
    </>
  );
}
