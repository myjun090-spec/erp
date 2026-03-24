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
    fetch(`/api/program-sessions/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="프로그램" title={String(data.docNo || data._id)} actions={<Link href="/programs/sessions" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="세션번호" value={typeof data.sessionNo === "object" ? JSON.stringify(data.sessionNo) : String(data.sessionNo ?? "-")} />
          <DetailField label="제목" value={typeof data.title === "object" ? JSON.stringify(data.title) : String(data.title ?? "-")} />
          <DetailField label="일자" value={typeof data.sessionDate === "object" ? JSON.stringify(data.sessionDate) : String(data.sessionDate ?? "-")} />
          <DetailField label="장소" value={typeof data.location === "object" ? JSON.stringify(data.location) : String(data.location ?? "-")} />
          <DetailField label="참석인원" value={typeof data.attendeeCount === "object" ? JSON.stringify(data.attendeeCount) : String(data.attendeeCount ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
