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
  { key: "currentStep", label: "현재단계" },
  { key: "status", label: "상태" },
];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/approval-documents?filter=pending").then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); }).finally(() => setLoading(false));
  }, []);

  const rows = items.map((i: Record<string, any>) => ({
    id: i._id,
    no: <span className="font-mono text-[color:var(--primary)]">{i.documentNo}</span>,
    title: i.title ?? "-",
    documentType: i.documentType ?? "-",
    currentStep: i.currentStep ?? "-",
    status: <StatusBadge label={i.overallStatus} tone={i.overallStatus === "active" || i.overallStatus === "completed" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader eyebrow="전자결재" title="결재 대기" actions={<PermissionLink permission="approval-document.create" href="/approval/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">등록</PermissionLink>} />
      <DataTable title="결재 대기" columns={columns} rows={rows} getRowKey={r => String(r.id)} onRowClick={r => router.push(`/approval/${String(r.id)}`)} loading={loading} emptyState={{ title: "데이터가 없습니다" }} />
    </>
  );
}
