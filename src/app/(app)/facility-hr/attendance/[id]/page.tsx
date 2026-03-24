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
    fetch(`/api/hr-attendance/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="시설/인사" title={String(data.docNo || data._id)} actions={<Link href="/facility-hr/attendance" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.attendanceNo === "object" ? JSON.stringify(data.attendanceNo) : String(data.attendanceNo ?? "-")} />
          <DetailField label="직원" value={typeof data.staffSnapshot === "object" ? JSON.stringify(data.staffSnapshot) : String(data.staffSnapshot ?? "-")} />
          <DetailField label="일자" value={typeof data.date === "object" ? JSON.stringify(data.date) : String(data.date ?? "-")} />
          <DetailField label="출근" value={typeof data.checkInTime === "object" ? JSON.stringify(data.checkInTime) : String(data.checkInTime ?? "-")} />
          <DetailField label="퇴근" value={typeof data.checkOutTime === "object" ? JSON.stringify(data.checkOutTime) : String(data.checkOutTime ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
