"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatePanel } from "@/components/ui/state-panel";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/programs/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="프로그램" title={String(data.docNo || data._id)} actions={<Link href="/programs" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="프로그램번호" value={typeof data.programNo === "object" ? JSON.stringify(data.programNo) : String(data.programNo ?? "-")} />
          <DetailField label="프로그램명" value={typeof data.name === "object" ? JSON.stringify(data.name) : String(data.name ?? "-")} />
          <DetailField label="분류" value={typeof data.category === "object" ? JSON.stringify(data.category) : String(data.category ?? "-")} />
          <DetailField label="대상" value={typeof data.targetGroup === "object" ? JSON.stringify(data.targetGroup) : String(data.targetGroup ?? "-")} />
          <DetailField label="총세션" value={typeof data.totalSessions === "object" ? JSON.stringify(data.totalSessions) : String(data.totalSessions ?? "-")} />
          <DetailField label="최대인원" value={typeof data.maxParticipants === "object" ? JSON.stringify(data.maxParticipants) : String(data.maxParticipants ?? "-")} />
          <DetailField label="예산" value={typeof data.budget === "object" ? JSON.stringify(data.budget) : String(data.budget ?? "-")} />
          <DetailField label="재원" value={typeof data.fundingSource === "object" ? JSON.stringify(data.fundingSource) : String(data.fundingSource ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
