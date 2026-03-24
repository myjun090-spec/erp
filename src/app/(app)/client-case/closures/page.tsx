"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

type Item = { _id: string; closureNo: string; clientSnapshot: { name: string }; closureReason: string; status: string };

const columns = [
  { key: "no", label: "종결번호" },
  { key: "client", label: "이용자" },
  { key: "reason", label: "종결사유" },
  { key: "status", label: "상태" },
];

export default function ClosuresPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/case-closures").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map(i => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.closureNo}</span>,
    client: i.clientSnapshot?.name ?? "-",
    reason: i.closureReason,
    status: <StatusBadge label={i.status} tone={i.status === "approved" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title="사례종결" actions={<PermissionLink permission="case-closure.create" href="/client-case/closures/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">종결 등록</PermissionLink>} />
      <DataTable title="사례종결" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/client-case/closures/${String(r.id)}`)} loading={loading} emptyState={{ title: "등록된 종결 건이 없습니다" }} />
    </>
  );
}
