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
    fetch(`/api/volunteers/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title={String(data.docNo || data._id)} actions={<Link href="/donation-volunteer/volunteers" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="봉사자번호" value={typeof data.volunteerNo === "object" ? JSON.stringify(data.volunteerNo) : String(data.volunteerNo ?? "-")} />
          <DetailField label="이름" value={typeof data.name === "object" ? JSON.stringify(data.name) : String(data.name ?? "-")} />
          <DetailField label="연락처" value={typeof data.phone === "object" ? JSON.stringify(data.phone) : String(data.phone ?? "-")} />
          <DetailField label="기술" value={typeof data.skills === "object" ? JSON.stringify(data.skills) : String(data.skills ?? "-")} />
          <DetailField label="가능요일" value={typeof data.availableDays === "object" ? JSON.stringify(data.availableDays) : String(data.availableDays ?? "-")} />
          <DetailField label="총시간" value={typeof data.totalHours === "object" ? JSON.stringify(data.totalHours) : String(data.totalHours ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
