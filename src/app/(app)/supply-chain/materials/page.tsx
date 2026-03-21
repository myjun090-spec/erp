"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";

type MaterialItem = { _id: string; materialCode: string; description: string; uom: string; specification: string; manufacturerName: string; category: string; status: string };
const columns = [
  { key: "code", label: "자재코드" }, { key: "description", label: "자재명" }, { key: "spec", label: "규격" },
  { key: "uom", label: "단위" }, { key: "manufacturer", label: "제조사" }, { key: "category", label: "분류" }, { key: "status", label: "상태" },
];

export default function MaterialsPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res = await fetch("/api/materials"); const json = await res.json(); if (json.ok) setItems(json.data.items); else setError(json.message); } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runBulk = async (action: string, targetIds: string[], label: string) => {
    const res = await fetch("/api/materials/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, targetIds }) });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: `${formatIntegerDisplay(json.affectedCount)}건 처리`, tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const rows = items.map(item => ({
    id: item._id,
    materialCodeValue: item.materialCode,
    code: <span className="font-mono text-[color:var(--primary)]">{item.materialCode}</span>,
    description: <span className="font-medium">{item.description}</span>,
    spec: item.specification || "-",
    uom: item.uom,
    manufacturer: item.manufacturerName || "-",
    category: item.category || "-",
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Supply Chain" title="자재 목록" description="자재 마스터를 관리합니다. 규격, 제조사, 성적서 이력을 추적합니다."
        meta={[{ label: "Database", tone: "success" }, { label: "Bulk Action", tone: "warning" }]}
        actions={<PermissionLink permission="material.create" href="/supply-chain/materials/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">자재 등록</PermissionLink>} />
      <BulkActionTable title="자재" description="MongoDB에서 조회한 자재 목록입니다." columns={columns} rows={rows} loading={loading}
        getRowKey={row => String(row.id)} errorState={error ? { title: "조회 실패", description: error } : null}
        onRowClick={(row) => {
          router.push(`/supply-chain/materials/${row.id}`);
        }}
        getRowAriaLabel={(row) => `${row.materialCodeValue} 상세 보기`}
        emptyState={{ title: "등록된 자재가 없습니다", description: "새 자재를 등록해 주세요." }}
        bulkActions={[
          {
            key: "activate",
            label: "활성화",
            tone: "success",
            isVisible: () => canAccessAction(viewerPermissions, "material.update"),
            onAction: (ids) => runBulk("activate", ids, "활성화"),
          },
          {
            key: "archive",
            label: "비활성",
            tone: "danger",
            isVisible: () => canAccessAction(viewerPermissions, "material.archive"),
            onAction: (ids) => runBulk("archive", ids, "비활성"),
          },
        ]} />
    </>
  );
}
