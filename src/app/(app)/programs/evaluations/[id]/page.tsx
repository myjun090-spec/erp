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
    fetch(`/api/performance-evaluations/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="프로그램" title={String(data.docNo || data._id)} actions={<Link href="/programs/evaluations" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="평가번호" value={typeof data.evalNo === "object" ? JSON.stringify(data.evalNo) : String(data.evalNo ?? "-")} />
          <DetailField label="프로그램" value={typeof data.programSnapshot === "object" ? JSON.stringify(data.programSnapshot) : String(data.programSnapshot ?? "-")} />
          <DetailField label="투입" value={typeof data.inputMetrics === "object" ? JSON.stringify(data.inputMetrics) : String(data.inputMetrics ?? "-")} />
          <DetailField label="산출" value={typeof data.outputMetrics === "object" ? JSON.stringify(data.outputMetrics) : String(data.outputMetrics ?? "-")} />
          <DetailField label="성과" value={typeof data.outcomeMetrics === "object" ? JSON.stringify(data.outcomeMetrics) : String(data.outcomeMetrics ?? "-")} />
          <DetailField label="등급" value={typeof data.overallGrade === "object" ? JSON.stringify(data.overallGrade) : String(data.overallGrade ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
