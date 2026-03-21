"use client";

import { useCallback, useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput } from "@/lib/business-tax-id";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";

type PartyItem = {
  _id: string;
  code: string;
  name: string;
  legalName: string;
  partyRoles: string[];
  taxId: string;
  country: string;
  status: string;
};

const roleTone: Record<string, "default" | "info" | "success" | "warning"> = {
  customer: "info",
  vendor: "warning",
  partner: "default",
  manufacturer: "success",
};

const columns = [
  { key: "code", label: "코드" },
  { key: "name", label: "거래처명" },
  { key: "roles", label: "유형" },
  { key: "taxId", label: "사업자번호" },
  { key: "country", label: "국가" },
  { key: "status", label: "상태" },
];

export default function PartiesPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<PartyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parties");
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
    const res = await fetch("/api/parties/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리 완료`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map((item) => ({
    id: item._id,
    codeValue: item.code,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code}</span>,
    name: <span className="font-medium">{item.name}</span>,
    roles: (
      <div className="flex flex-wrap gap-1">
        {item.partyRoles.map((role) => (
          <StatusBadge key={role} label={role} tone={roleTone[role] || "default"} />
        ))}
      </div>
    ),
    taxId: item.taxId ? formatBusinessTaxIdInput(item.taxId) : "-",
    country: item.country,
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="거래처 목록"
        description="고객, 공급업체, 파트너를 통합 관리합니다. 거래처 유형과 적격 상태를 추적합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Bulk Action", tone: "warning" },
        ]}
        actions={
          <PermissionLink permission="party.create" href="/business-development/parties/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            거래처 등록
          </PermissionLink>
        }
      />
      <BulkActionTable
        title="거래처"
        description="MongoDB에서 조회한 거래처 통합 목록입니다. 유형별 일괄 상태 변경을 지원합니다."
        columns={columns}
        rows={rows}
        loading={loading}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) =>
          router.push(`/business-development/parties/${String(row.id)}`)
        }
        getRowAriaLabel={(row) =>
          `${String(row.codeValue)} 거래처 상세 열기`
        }
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 거래처가 없습니다", description: "새 거래처를 등록해 주세요." }}
        bulkActions={[
          {
            key: "activate",
            label: "활성화",
            tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "party.update"),
            confirmTitle: "선택한 거래처를 활성화할까요?",
            confirmDescription: "비활성 거래처를 활성 상태로 복구합니다.",
            onAction: (ids) => runBulk("activate", ids, "거래처 활성화"),
          },
          {
            key: "suspend",
            label: "거래 중지",
            tone: "danger",
            isVisible: () => canAccessAction(viewerPermissions, "party.update"),
            confirmTitle: "선택한 거래처를 거래 중지할까요?",
            confirmDescription: "해당 거래처와의 거래를 중지합니다.",
            onAction: (ids) => runBulk("suspend", ids, "거래 중지"),
          },
          {
            key: "archive",
            label: "보관",
            tone: "danger",
            isVisible: () => canAccessAction(viewerPermissions, "party.archive"),
            confirmTitle: "선택한 거래처를 보관할까요?",
            confirmDescription: "보관된 거래처는 기본 목록에서 제외됩니다.",
            onAction: (ids) => runBulk("archive", ids, "거래처 보관"),
          },
        ]}
      />
    </>
  );
}
