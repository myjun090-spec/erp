"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";

type Detail = { _id: string; closureNo: string; clientSnapshot: { name: string }; closureReason: string; followUpPlan: string; status: string };

export default function ClosureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/case-closures/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title={data.closureNo} actions={<Link href="/client-case/closures" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2">
          <DetailField label="종결번호" value={data.closureNo} />
          <DetailField label="이용자" value={data.clientSnapshot?.name} />
          <DetailField label="종결사유" value={data.closureReason} />
          <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "approved" ? "success" : "default"} />} />
        </dl>
        <div className="mt-4"><DetailField label="사후관리계획" value={data.followUpPlan || "-"} /></div>
      </Panel>
    </>
  );
}
