"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type NcrDoc = {
  _id: string;
  ncrNo: string;
  severity: string;
  disposition?: string;
  description?: string;
  dueDate?: string;
  status: string;
  projectSnapshot: { code: string; name: string } | null;
  systemSnapshot: { code: string; name: string } | null;
  ownerUserSnapshot: { displayName?: string; orgUnitName?: string; email?: string } | null;
};

const SEVERITY_LABELS: Record<string, string> = { minor: "경미", major: "중대", critical: "치명" };
const SEVERITY_TONE: Record<string, "default"|"warning"|"danger"> = { minor: "default", major: "warning", critical: "danger" };
const DISPOSITION_LABELS: Record<string, string> = { rework: "재작업", repair: "수리", scrap: "폐기", "accept-as-is": "특채" };
const STATUS_LABELS: Record<string, string> = { open: "접수", investigating: "조사중", disposition: "처분중", closed: "종결" };
const STATUS_TONE: Record<string, "default"|"info"|"warning"|"success"> = { open: "info", investigating: "warning", disposition: "warning", closed: "success" };

export default function NcrDetailPage() {
  const { ncrId } = useParams<{ ncrId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<NcrDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ncrs/${ncrId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [ncrId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeStatus = async (next: string, label: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/ncrs/${ncrId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (json.ok) { pushToast({ title: label, description: "상태가 변경되었습니다.", tone: "success" }); fetchData(); }
      else pushToast({ title: "오류", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setTransitioning(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("NCR을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ncrs/${ncrId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "삭제 완료", description: "NCR이 삭제되었습니다.", tone: "success" });
        router.push("/quality/ncr");
      } else pushToast({ title: "삭제 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setDeleting(false); }
  };

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="NCR 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/quality/ncr" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const canUpdateNcr = canAccessAction(viewerPermissions, "ncr.update");
  const canArchiveNcr = canAccessAction(viewerPermissions, "ncr.archive");

  return (
    <>
      <PageHeader
        eyebrow="Quality"
        title={doc.ncrNo}
        description={SEVERITY_LABELS[doc.severity] ?? doc.severity}
        meta={[
          { label: "Database", tone: "success" },
          { label: SEVERITY_LABELS[doc.severity] ?? doc.severity, tone: SEVERITY_TONE[doc.severity] ?? "default" },
          { label: STATUS_LABELS[doc.status] ?? doc.status, tone: STATUS_TONE[doc.status] ?? "default" },
        ]}
        actions={<>
          <Link href="/quality/ncr" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canUpdateNcr ? (
            <PermissionLink permission="ncr.update" href={`/quality/ncr/${ncrId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {doc.status === "open" && (
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("investigating", "조사 시작")} disabled={transitioning} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">조사 시작</PermissionButton>
          )}
          {doc.status === "investigating" && (<>
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("open", "접수로 되돌리기")} disabled={transitioning} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] disabled:opacity-50">접수로 되돌리기</PermissionButton>
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("disposition", "처분 진행")} disabled={transitioning} className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">처분 진행</PermissionButton>
          </>)}
          {doc.status === "disposition" && (<>
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("investigating", "조사중으로 되돌리기")} disabled={transitioning} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] disabled:opacity-50">조사중으로 되돌리기</PermissionButton>
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("closed", "종결")} disabled={transitioning} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">종결</PermissionButton>
          </>)}
          {doc.status === "closed" && (
            <PermissionButton permission="ncr.update" onClick={() => changeStatus("open", "재개")} disabled={transitioning} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)] disabled:opacity-50">재개</PermissionButton>
          )}
          {canArchiveNcr ? (
            <PermissionButton permission="ncr.archive" onClick={handleDelete} disabled={deleting} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)] disabled:opacity-50">{deleting ? "삭제 중..." : "삭제"}</PermissionButton>
          ) : null}
        </>}
      />
      <Panel className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">NCR 정보</h3>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="NCR번호" value={<span className="font-mono">{doc.ncrNo}</span>} />
          <DetailField label="심각도" value={<StatusBadge label={SEVERITY_LABELS[doc.severity] ?? doc.severity} tone={SEVERITY_TONE[doc.severity] ?? "default"} />} />
          <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[doc.status] ?? doc.status} tone={STATUS_TONE[doc.status] ?? "default"} />} />
          <DetailField label="처분" value={doc.disposition ? (DISPOSITION_LABELS[doc.disposition] ?? doc.disposition) : "-"} />
          <DetailField label="기한" value={doc.dueDate || "-"} />
          <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
          <DetailField label="계통" value={doc.systemSnapshot ? `${doc.systemSnapshot.code} · ${doc.systemSnapshot.name}` : "-"} />
          <DetailField label="담당자" value={doc.ownerUserSnapshot?.displayName || "-"} />
          <DetailField label="소속" value={doc.ownerUserSnapshot?.orgUnitName || "-"} />
          {doc.description && (
            <div className="md:col-span-2 lg:col-span-3">
              <DetailField label="설명" value={doc.description} />
            </div>
          )}
        </dl>
      </Panel>
    </>
  );
}
