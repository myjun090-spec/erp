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
    fetch(`/api/staff/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="시설/인사" title={String(data.docNo || data._id)} actions={<Link href="/facility-hr" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="직원번호" value={typeof data.staffNo === "object" ? JSON.stringify(data.staffNo) : String(data.staffNo ?? "-")} />
          <DetailField label="이름" value={typeof data.name === "object" ? JSON.stringify(data.name) : String(data.name ?? "-")} />
          <DetailField label="직위" value={typeof data.position === "object" ? JSON.stringify(data.position) : String(data.position ?? "-")} />
          <DetailField label="부서" value={typeof data.department === "object" ? JSON.stringify(data.department) : String(data.department ?? "-")} />
          <DetailField label="계약유형" value={typeof data.contractType === "object" ? JSON.stringify(data.contractType) : String(data.contractType ?? "-")} />
          <DetailField label="자격증" value={typeof data.qualifications === "object" ? JSON.stringify(data.qualifications) : String(data.qualifications ?? "-")} />
          <DetailField label="교육이력" value={typeof data.trainings === "object" ? JSON.stringify(data.trainings) : String(data.trainings ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
