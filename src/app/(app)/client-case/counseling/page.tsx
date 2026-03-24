"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

type Item = { _id: string; counselingNo: string; clientSnapshot: { name: string }; sessionType: string; duration: number; status: string };

const columns = [
  { key: "no", label: "상담번호" },
  { key: "client", label: "이용자" },
  { key: "type", label: "상담유형" },
  { key: "duration", label: "시간(분)" },
  { key: "status", label: "상태" },
];

export default function CounselingPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/counseling-records").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map(i => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.counselingNo}</span>,
    client: i.clientSnapshot?.name ?? "-",
    type: i.sessionType,
    duration: String(i.duration),
    status: <StatusBadge label={i.status} tone={i.status === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title="상담기록" description="상담기록을 관리합니다." actions={<PermissionLink permission="counseling.create" href="/client-case/counseling/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">상담기록 등록</PermissionLink>} />
      <DataTable title="상담기록" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/client-case/counseling/${String(r.id)}`)} loading={loading} emptyState={{ title: "등록된 상담기록이 없습니다" }} />
    </>
  );
}
