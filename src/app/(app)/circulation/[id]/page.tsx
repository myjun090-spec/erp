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
    fetch(`/api/circulation-posts/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="공람함" title={String(data.docNo || data._id)} actions={<Link href="/circulation" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.circulationNo === "object" ? JSON.stringify(data.circulationNo) : String(data.circulationNo ?? "-")} />
          <DetailField label="제목" value={typeof data.title === "object" ? JSON.stringify(data.title) : String(data.title ?? "-")} />
          <DetailField label="내용" value={typeof data.content === "object" ? JSON.stringify(data.content) : String(data.content ?? "-")} />
          <DetailField label="작성자" value={typeof data.authorSnapshot === "object" ? JSON.stringify(data.authorSnapshot) : String(data.authorSnapshot ?? "-")} />
          <DetailField label="미확인" value={typeof data.unviewedCount === "object" ? JSON.stringify(data.unviewedCount) : String(data.unviewedCount ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
