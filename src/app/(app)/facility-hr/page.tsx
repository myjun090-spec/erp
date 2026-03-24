"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "번호" },
  { key: "name", label: "이름" },
  { key: "position", label: "직위" },
  { key: "department", label: "부서" },
  { key: "contractType", label: "계약유형" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/staff").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.staffNo}</span>,
    name: i.name ?? "-",
    position: i.position ?? "-",
    department: i.department ?? "-",
    contractType: i.contractType ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="시설/인사" title="직원 목록" actions={<PermissionLink permission="staff.create" href="/facility-hr/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="직원 목록" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/facility-hr/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
