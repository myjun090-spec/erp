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
    fetch(`/api/subsidies/${id}`).then(r => r.json()).then(j => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="데이터를 불러오고 있습니다." />;
  if (!data) return <StatePanel variant="error" title="조회 실패" description="데이터를 불러올 수 없습니다." />;

  return (
    <>
      <PageHeader eyebrow="재무" title={String(data.docNo || data._id)} actions={<Link href="/finance/subsidies" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">목록으로</Link>} />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="번호" value={typeof data.subsidyNo === "object" ? JSON.stringify(data.subsidyNo) : String(data.subsidyNo ?? "-")} />
          <DetailField label="보조금명" value={typeof data.grantName === "object" ? JSON.stringify(data.grantName) : String(data.grantName ?? "-")} />
          <DetailField label="교부기관" value={typeof data.grantingAuthority === "object" ? JSON.stringify(data.grantingAuthority) : String(data.grantingAuthority ?? "-")} />
          <DetailField label="유형" value={typeof data.grantType === "object" ? JSON.stringify(data.grantType) : String(data.grantType ?? "-")} />
          <DetailField label="교부액" value={typeof data.grantAmount === "object" ? JSON.stringify(data.grantAmount) : String(data.grantAmount ?? "-")} />
          <DetailField label="수령액" value={typeof data.receivedAmount === "object" ? JSON.stringify(data.receivedAmount) : String(data.receivedAmount ?? "-")} />
          <DetailField label="집행액" value={typeof data.usedAmount === "object" ? JSON.stringify(data.usedAmount) : String(data.usedAmount ?? "-")} />
          <DetailField label="상태" value={typeof data.status === "object" ? JSON.stringify(data.status) : String(data.status ?? "-")} />
        </dl>
      </Panel>
    </>
  );
}
