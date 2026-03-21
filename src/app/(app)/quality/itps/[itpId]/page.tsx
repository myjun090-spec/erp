"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";

type ItpDoc = {
  _id: string;
  code: string;
  name: string;
  revisionNo: number;
  approvalStatus: string;
  status: string;
  projectSnapshot: { code: string; name: string } | null;
  systemSnapshot: { code: string; name: string } | null;
};

const APPROVAL_LABELS: Record<string, string> = { draft: "초안", review: "검토중", approved: "승인" };
const APPROVAL_TONE: Record<string, "default" | "warning" | "success"> = { draft: "default", review: "warning", approved: "success" };

export default function ItpDetailPage() {
  const { itpId } = useParams<{ itpId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<ItpDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/itps/${itpId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [itpId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeApproval = async (next: string, label: string) => {
    const res = await fetch(`/api/itps/${itpId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: next }),
    });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: "승인 상태가 변경되었습니다.", tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  if (loading) return <StatePanel variant="loading" title="ITP 로딩 중" description="ITP 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/quality/itps" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const canUpdateItp = canAccessAction(viewerPermissions, "itp.update");

  return (
    <>
      <PageHeader
        eyebrow="Quality"
        title={doc.code}
        description={doc.name}
        meta={[
          { label: "Database", tone: "success" },
          { label: APPROVAL_LABELS[doc.approvalStatus] ?? doc.approvalStatus, tone: APPROVAL_TONE[doc.approvalStatus] ?? "default" },
          { label: doc.status === "active" ? "활성" : doc.status, tone: doc.status === "active" ? "success" : "default" },
        ]}
        actions={<>
          <Link href="/quality/itps" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canUpdateItp ? (
            <PermissionLink permission="itp.update" href={`/quality/itps/${itpId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {doc.approvalStatus === "draft" && (
            <PermissionButton permission="itp.update" onClick={() => changeApproval("review", "검토 요청")} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">검토 요청</PermissionButton>
          )}
          {doc.approvalStatus === "review" && (
            <PermissionButton permission="itp.update" onClick={() => changeApproval("approved", "승인")} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">승인</PermissionButton>
          )}
          {doc.approvalStatus === "approved" && (
            <PermissionButton permission="itp.update" onClick={() => changeApproval("draft", "승인 취소")} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">승인 취소</PermissionButton>
          )}
        </>}
      />
      <Panel className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">상세정보</h3>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="ITP 코드" value={<span className="font-mono">{doc.code}</span>} />
          <DetailField label="ITP명" value={doc.name} />
          <DetailField label="Rev." value={`Rev.${doc.revisionNo ?? 0}`} />
          <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
          <DetailField label="계통" value={doc.systemSnapshot ? `${doc.systemSnapshot.code} · ${doc.systemSnapshot.name}` : "-"} />
          <DetailField label="승인" value={<StatusBadge label={APPROVAL_LABELS[doc.approvalStatus] ?? doc.approvalStatus} tone={APPROVAL_TONE[doc.approvalStatus] ?? "default"} />} />
          <DetailField label="상태" value={<StatusBadge label={doc.status === "active" ? "활성" : doc.status} tone={doc.status === "active" ? "success" : "default"} />} />
        </dl>
      </Panel>
    </>
  );
}
