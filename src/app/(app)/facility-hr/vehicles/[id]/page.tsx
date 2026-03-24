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
    fetch(`/api/vehicles/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="시설/인사" title={String(data.docNo || data._id)} actions={<Link href="/facility-hr/vehicles" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.vehicleNo === "object" ? JSON.stringify(data.vehicleNo) : String(data.vehicleNo ?? "-")} />
          <DetailField label="차량번호" value={typeof data.licensePlate === "object" ? JSON.stringify(data.licensePlate) : String(data.licensePlate ?? "-")} />
          <DetailField label="차종" value={typeof data.vehicleType === "object" ? JSON.stringify(data.vehicleType) : String(data.vehicleType ?? "-")} />
          <DetailField label="용도" value={typeof data.purpose === "object" ? JSON.stringify(data.purpose) : String(data.purpose ?? "-")} />
          <DetailField label="정비이력" value={typeof data.maintenanceLogs === "object" ? JSON.stringify(data.maintenanceLogs) : String(data.maintenanceLogs ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
