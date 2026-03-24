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
    fetch(`/api/in-kind-donations/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title={String(data.docNo || data._id)} actions={<Link href="/donation-volunteer/in-kind" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.donationNo === "object" ? JSON.stringify(data.donationNo) : String(data.donationNo ?? "-")} />
          <DetailField label="후원자" value={typeof data.donorSnapshot === "object" ? JSON.stringify(data.donorSnapshot) : String(data.donorSnapshot ?? "-")} />
          <DetailField label="물품명" value={typeof data.itemName === "object" ? JSON.stringify(data.itemName) : String(data.itemName ?? "-")} />
          <DetailField label="수량" value={typeof data.quantity === "object" ? JSON.stringify(data.quantity) : String(data.quantity ?? "-")} />
          <DetailField label="추정가액" value={typeof data.estimatedValue === "object" ? JSON.stringify(data.estimatedValue) : String(data.estimatedValue ?? "-")} />
          <DetailField label="배분처" value={typeof data.distributedTo === "object" ? JSON.stringify(data.distributedTo) : String(data.distributedTo ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
