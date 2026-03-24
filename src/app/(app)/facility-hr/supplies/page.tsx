"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "번호" },
  { key: "itemName", label: "품명" },
  { key: "category", label: "분류" },
  { key: "currentStock", label: "재고" },
  { key: "minimumStock", label: "최소재고" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/facility-supplies").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.supplyNo}</span>,
    itemName: i.itemName ?? "-",
    category: i.category ?? "-",
    currentStock: i.currentStock ?? "-",
    minimumStock: i.minimumStock ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="시설/인사" title="비품 관리" actions={<PermissionLink permission="supply.create" href="/facility-hr/supplies/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="비품 관리" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/facility-hr/supplies/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
