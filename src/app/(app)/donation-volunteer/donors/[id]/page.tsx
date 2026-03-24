"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type DonorDetail = {
  _id: string;
  donorNo: string;
  donorType: string;
  name: string;
  representativeName: string;
  phone: string;
  email: string;
  address: string;
  taxIdNo: string;
  donorCategory: string;
  preferredUsage: string;
  facilitySnapshot: { name: string } | null;
  status: string;
};

function getStatusTone(status: string) {
  switch (status) { case "active": return "success"; case "inactive": return "warning"; default: return "default"; }
}

export default function DonorDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { pushToast } = useToast();
  const [data, setData] = useState<DonorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/donors/${id}`);
      const json = await res.json();
      if (!json.ok) { setError(json.message || "후원자를 불러오지 못했습니다."); return; }
      setData(json.data);
    } catch { setError("네트워크 오류가 발생했습니다."); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/donors/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
      const json = await response.json();
      if (!json.ok) { pushToast({ title: "보관 실패", description: json.message, tone: "warning" }); return; }
      pushToast({ title: "보관 완료", description: "후원자가 보관되었습니다.", tone: "success" });
      router.push("/donation-volunteer/donors");
    } catch { pushToast({ title: "보관 실패", description: "네트워크 오류", tone: "warning" }); }
    finally { setArchiving(false); setArchiveConfirmOpen(false); }
  };

  if (loading) return <StatePanel variant="loading" title="후원자 로딩 중" description="후원자 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="후원자 조회 실패" description={error || "데이터가 없습니다."} />;

  return (
    <>
      <PageHeader eyebrow="Donation & Volunteer" title={`${data.donorNo} ${data.name}`} description={`${data.donorType} · ${data.donorCategory}`}
        meta={[{ label: data.donorType, tone: "info" }, { label: data.status, tone: getStatusTone(data.status) }]}
        actions={
          <>
            {data.status !== "archived" ? (
              <PermissionButton permission="donor.archive" type="button" onClick={() => setArchiveConfirmOpen(true)} className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]">보관</PermissionButton>
            ) : null}
            <Link href="/donation-volunteer/donors" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
            {data.status !== "archived" ? (
              <PermissionLink permission="donor.update" href={`/donation-volunteer/donors/${data._id}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">수정</PermissionLink>
            ) : null}
          </>
        }
      />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="후원자번호" value={<span className="font-mono">{data.donorNo}</span>} />
          <DetailField label="후원자명" value={data.name} />
          <DetailField label="유형" value={data.donorType} />
          <DetailField label="대표자명" value={data.representativeName || "-"} />
          <DetailField label="연락처" value={data.phone || "-"} />
          <DetailField label="이메일" value={data.email || "-"} />
          <DetailField label="사업자번호" value={data.taxIdNo || "-"} />
          <DetailField label="후원구분" value={data.donorCategory || "-"} />
          <DetailField label="용도지정" value={data.preferredUsage || "-"} />
          <DetailField label="시설" value={data.facilitySnapshot?.name || "-"} />
          <DetailField label="상태" value={<StatusBadge label={data.status} tone={getStatusTone(data.status)} />} />
        </dl>
        <div className="mt-4">
          <DetailField label="주소" value={data.address || "-"} />
        </div>
      </Panel>
      <ConfirmDialog open={archiveConfirmOpen} title="후원자 보관" description={`${data.donorNo} 후원자를 보관합니다.`}
        confirmLabel={archiving ? "보관 중..." : "보관"} tone="danger"
        onClose={() => { if (!archiving) setArchiveConfirmOpen(false); }}
        onConfirm={() => { if (!archiving) void handleArchive(); }}
      />
    </>
  );
}
