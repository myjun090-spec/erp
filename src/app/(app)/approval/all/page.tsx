"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionLink } from "@/components/auth/permission-link";

const columns = [
  { key: "no", label: "문서번호" },
  { key: "title", label: "제목" },
  { key: "documentType", label: "문서유형" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/approval-documents").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.documentNo}</span>,
    title: i.title ?? "-",
    documentType: i.documentType ?? "-",
    status: <StatusBadge label={i.overallStatus} tone={i.overallStatus === "active" || i.overallStatus === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="전자결재" title="전체 문서함" actions={null} />
      <DataTable title="전체 문서함" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/approval/all/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
