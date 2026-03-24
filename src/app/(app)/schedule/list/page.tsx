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
  { key: "date", label: "일자" },
  { key: "startTime", label: "시작" },
  { key: "endTime", label: "종료" },
  { key: "category", label: "분류" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/schedules").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.scheduleNo}</span>,
    title: i.title ?? "-",
    date: i.date ?? "-",
    startTime: i.startTime ?? "-",
    endTime: i.endTime ?? "-",
    category: i.category ?? "-",
    status: <StatusBadge label={i.status} tone={i.status === "active" || i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="일정관리" title="일정 목록" actions={<PermissionLink permission="schedule.create" href="/schedule/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="일정 목록" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/schedule/list/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
