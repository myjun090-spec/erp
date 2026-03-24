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
    fetch(`/api/facility-supplies/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="시설/인사" title={String(data.docNo || data._id)} actions={<Link href="/facility-hr/supplies" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.supplyNo === "object" ? JSON.stringify(data.supplyNo) : String(data.supplyNo ?? "-")} />
          <DetailField label="품명" value={typeof data.itemName === "object" ? JSON.stringify(data.itemName) : String(data.itemName ?? "-")} />
          <DetailField label="분류" value={typeof data.category === "object" ? JSON.stringify(data.category) : String(data.category ?? "-")} />
          <DetailField label="재고" value={typeof data.currentStock === "object" ? JSON.stringify(data.currentStock) : String(data.currentStock ?? "-")} />
          <DetailField label="최소" value={typeof data.minimumStock === "object" ? JSON.stringify(data.minimumStock) : String(data.minimumStock ?? "-")} />
          <DetailField label="단가" value={typeof data.unitPrice === "object" ? JSON.stringify(data.unitPrice) : String(data.unitPrice ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
