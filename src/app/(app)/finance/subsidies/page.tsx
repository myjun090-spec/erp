"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "번호" },
  { key: "grantName", label: "보조금명" },
  { key: "grantingAuthority", label: "교부기관" },
  { key: "grantAmount", label: "교부액" },
  { key: "usedAmount", label: "집행액" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subsidies").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.subsidyNo}</span>,
    grantName: i.grantName ?? "-",
    grantingAuthority: i.grantingAuthority ?? "-",
    grantAmount: i.grantAmount ?? "-",
    usedAmount: i.usedAmount ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="재무" title="보조금 관리" actions={<PermissionLink permission="subsidy.create" href="/finance/subsidies/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="보조금 관리" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/finance/subsidies/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
