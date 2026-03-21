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

type VendorItem = { _id: string; code: string; name: string; legalName: string; taxId: string; country: string; partyRoles: string[]; qualifications: { type: string; status: string }[]; status: string };
const columns = [
  { key: "code", label: "업체코드" }, { key: "name", label: "업체명" }, { key: "legalName", label: "법인명" },
  { key: "taxId", label: "사업자번호" }, { key: "country", label: "국가" }, { key: "qual", label: "인증" }, { key: "status", label: "상태" },
];

export default function VendorsPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch("/api/vendors"); const json = await res.json(); if (json.ok) setItems(json.data.items); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/vendors/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    codeValue: item.code,
    nameValue: item.name,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code}</span>,
    name: <span className="font-medium">{item.name}</span>,
    legalName: item.legalName || "-",
    taxId: item.taxId || "-",
    country: item.country,
    qual: (item.qualifications || []).length > 0
      ? <div className="flex flex-wrap gap-1">{item.qualifications.map((q, i) => <StatusBadge key={i} label={q.type} tone={q.status === "valid" ? "success" : "warning"} />)}</div>
      : <span className="text-[color:var(--text-muted)]">-</span>,
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Supply Chain" title="공급업체 목록"
        description="공급업체를 등록하고 적격심사 현황을 관리합니다. 배치 액션으로 승인 요청과 상태 변경을 처리합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="vendor.create" href="/supply-chain/vendors/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">공급업체 등록</PermissionLink>} />
      <BulkActionTable title="공급업체" description="MongoDB에서 조회한 공급업체(vendor 역할) 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)}
        onRowClick={(row) => {
          router.push(`/supply-chain/vendors/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.nameValue)} 공급업체 상세 열기`}
        errorState={error ? { title: "조회 실패", description: error } : null}
        emptyState={{ title: "등록된 공급업체가 없습니다" }}
        bulkActions={[
          { key: "request-approval", label: "승인 요청", tone: "info", confirmTitle: "선택한 공급업체를 승인 요청할까요?",
            isVisible: () => canAccessAction(viewerPermissions, "vendor.update"),
            onAction: (ids) => runBulk("request-approval", ids, "승인 요청") },
          { key: "suspend", label: "거래 중지", tone: "danger", confirmTitle: "선택한 공급업체를 거래 중지할까요?",
            isVisible: () => canAccessAction(viewerPermissions, "vendor.update"),
            onAction: (ids) => runBulk("suspend", ids, "거래 중지") },
          { key: "restore", label: "활성 복구", tone: "success", confirmTitle: "선택한 공급업체를 활성 복구할까요?",
            isVisible: () => canAccessAction(viewerPermissions, "vendor.update"),
            onAction: (ids) => runBulk("restore", ids, "활성 복구") },
        ]} />
    </>
  );
}
