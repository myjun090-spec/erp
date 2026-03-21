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

type InspectionDoc = {
  _id: string;
  inspectionNo: string;
  inspectionType: string;
  inspectionDate: string;
  result: string;
  holdPoint: boolean;
  description?: string;
  status: string;
  projectSnapshot: { code: string; name: string } | null;
  systemSnapshot: { code: string; name: string } | null;
};

const RESULT_LABELS: Record<string, string> = { pass: "합격", fail: "불합격", conditional: "조건부합격" };
const RESULT_TONE: Record<string, "default"|"success"|"danger"|"warning"> = { pass: "success", fail: "danger", conditional: "warning" };
const STATUS_LABELS: Record<string, string> = { pending: "대기", "in-progress": "진행중", completed: "완료", verified: "검증" };
const STATUS_TONE: Record<string, "default"|"info"|"success"|"warning"> = { pending: "default", "in-progress": "info", completed: "success", verified: "success" };

export default function InspectionDetailPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<InspectionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [inspectionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeStatus = async (next: string, label: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
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
    if (!window.confirm("검사 이력을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "삭제 완료", description: "검사 이력이 삭제되었습니다.", tone: "success" });
        router.push("/quality/inspections");
      } else pushToast({ title: "삭제 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setDeleting(false); }
  };

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="검사 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/quality/inspections" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const canUpdateInspection = canAccessAction(viewerPermissions, "inspection.update");
  const canArchiveInspection = canAccessAction(viewerPermissions, "inspection.archive");

  return (
    <>
      <PageHeader
        eyebrow="Quality"
        title={doc.inspectionNo}
        description={doc.inspectionType}
        meta={[
          { label: "Database", tone: "success" },
          { label: RESULT_LABELS[doc.result] ?? doc.result, tone: RESULT_TONE[doc.result] ?? "default" },
          { label: STATUS_LABELS[doc.status] ?? doc.status, tone: STATUS_TONE[doc.status] ?? "default" },
        ]}
        actions={<>
          <Link href="/quality/inspections" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canUpdateInspection ? (
            <PermissionLink permission="inspection.update" href={`/quality/inspections/${inspectionId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {doc.status === "pending" && (
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("in-progress", "검사 시작")} disabled={transitioning} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">검사 시작</PermissionButton>
          )}
          {doc.status === "in-progress" && (<>
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("pending", "대기로 되돌리기")} disabled={transitioning} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] disabled:opacity-50">대기로 되돌리기</PermissionButton>
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("completed", "완료 처리")} disabled={transitioning} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">완료 처리</PermissionButton>
          </>)}
          {doc.status === "completed" && (<>
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("in-progress", "완료 취소")} disabled={transitioning} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] disabled:opacity-50">완료 취소</PermissionButton>
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("verified", "검증 완료")} disabled={transitioning} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">검증 완료</PermissionButton>
          </>)}
          {doc.status === "verified" && (
            <PermissionButton permission="inspection.update" onClick={() => changeStatus("completed", "검증 취소")} disabled={transitioning} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)] disabled:opacity-50">검증 취소</PermissionButton>
          )}
          {canArchiveInspection ? (
            <PermissionButton permission="inspection.archive" onClick={handleDelete} disabled={deleting} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)] disabled:opacity-50">{deleting ? "삭제 중..." : "삭제"}</PermissionButton>
          ) : null}
        </>}
      />
      <Panel className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">검사 정보</h3>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="검사번호" value={<span className="font-mono">{doc.inspectionNo}</span>} />
          <DetailField label="검사유형" value={doc.inspectionType} />
          <DetailField label="검사일" value={doc.inspectionDate} />
          <DetailField label="결과" value={<StatusBadge label={RESULT_LABELS[doc.result] ?? doc.result} tone={RESULT_TONE[doc.result] ?? "default"} />} />
          <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[doc.status] ?? doc.status} tone={STATUS_TONE[doc.status] ?? "default"} />} />
          <DetailField label="Hold Point" value={doc.holdPoint ? <StatusBadge label="지정됨" tone="warning" /> : <span className="text-[color:var(--text-muted)]">해당 없음</span>} />
          <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
          <DetailField label="계통" value={doc.systemSnapshot ? `${doc.systemSnapshot.code} · ${doc.systemSnapshot.name}` : "-"} />
          {doc.description && (
            <div className="md:col-span-2 lg:col-span-3">
              <DetailField label="비고" value={doc.description} />
            </div>
          )}
        </dl>
      </Panel>
    </>
  );
}
