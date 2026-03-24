"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "번호" },
  { key: "title", label: "제목" },
  { key: "sessionDate", label: "일자" },
  { key: "location", label: "장소" },
  { key: "attendeeCount", label: "참석" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/program-sessions").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.sessionNo}</span>,
    title: i.title ?? "-",
    sessionDate: i.sessionDate ?? "-",
    location: i.location ?? "-",
    attendeeCount: i.attendeeCount ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="프로그램" title="세션/활동" actions={<PermissionLink permission="program.create" href="/programs/sessions/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="세션/활동" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/programs/sessions/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
