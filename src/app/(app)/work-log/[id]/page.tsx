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
    fetch(`/api/work-logs/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="업무일지" title={String(data.docNo || data._id)} actions={<Link href="/work-log" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.workLogNo === "object" ? JSON.stringify(data.workLogNo) : String(data.workLogNo ?? "-")} />
          <DetailField label="직원" value={typeof data.staffSnapshot === "object" ? JSON.stringify(data.staffSnapshot) : String(data.staffSnapshot ?? "-")} />
          <DetailField label="시작일" value={typeof data.weekStartDate === "object" ? JSON.stringify(data.weekStartDate) : String(data.weekStartDate ?? "-")} />
          <DetailField label="종료일" value={typeof data.weekEndDate === "object" ? JSON.stringify(data.weekEndDate) : String(data.weekEndDate ?? "-")} />
          <DetailField label="목표" value={typeof data.weeklyGoals === "object" ? JSON.stringify(data.weeklyGoals) : String(data.weeklyGoals ?? "-")} />
          <DetailField label="성과" value={typeof data.achievements === "object" ? JSON.stringify(data.achievements) : String(data.achievements ?? "-")} />
          <DetailField label="다음주" value={typeof data.nextWeekPlan === "object" ? JSON.stringify(data.nextWeekPlan) : String(data.nextWeekPlan ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
