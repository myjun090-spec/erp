"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "번호" },
  { key: "staffName", label: "직원" },
  { key: "weekStartDate", label: "시작일" },
  { key: "weekEndDate", label: "종료일" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/work-logs").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.workLogNo}</span>,
    staffName: i.staffName ?? "-",
    weekStartDate: i.weekStartDate ?? "-",
    weekEndDate: i.weekEndDate ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="업무일지" title="주간실적보고" actions={<PermissionLink permission="work-log.create" href="/work-log/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="주간실적보고" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/work-log/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
