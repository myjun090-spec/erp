"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";

type Detail = { _id: string; counselingNo: string; clientSnapshot: { name: string }; sessionType: string; duration: number; content: string; status: string };

export default function CounselingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/counseling-records/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title={data.counselingNo} actions={<Link href="/client-case/counseling" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="상담번호" value={data.counselingNo} />
          <DetailField label="이용자" value={data.clientSnapshot?.name} />
          <DetailField label="상담유형" value={data.sessionType} />
          <DetailField label="상담시간" value={`${data.duration}분`} />
          <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "completed" ? "success" : "default"} />} />
        </dl>
        <div className="mt-4"><DetailField label="상담내용" value={data.content || "-"} /></div>
      </Panel>
    </>
  );
}
