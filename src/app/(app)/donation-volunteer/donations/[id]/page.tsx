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
    fetch(`/api/donations/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title={String(data.docNo || data._id)} actions={<Link href="/donation-volunteer/donations" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="후원번호" value={typeof data.donationNo === "object" ? JSON.stringify(data.donationNo) : String(data.donationNo ?? "-")} />
          <DetailField label="후원자" value={typeof data.donorSnapshot === "object" ? JSON.stringify(data.donorSnapshot) : String(data.donorSnapshot ?? "-")} />
          <DetailField label="유형" value={typeof data.donationType === "object" ? JSON.stringify(data.donationType) : String(data.donationType ?? "-")} />
          <DetailField label="금액" value={typeof data.amount === "object" ? JSON.stringify(data.amount) : String(data.amount ?? "-")} />
          <DetailField label="결제방법" value={typeof data.paymentMethod === "object" ? JSON.stringify(data.paymentMethod) : String(data.paymentMethod ?? "-")} />
          <DetailField label="영수증" value={typeof data.receiptIssued === "object" ? JSON.stringify(data.receiptIssued) : String(data.receiptIssued ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
