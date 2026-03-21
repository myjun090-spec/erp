"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";

const TYPE_LABELS: Record<string, string> = {
  license: "인허가", inspection: "검사", report: "보고", submission: "제출", closure: "종결", query: "질의",
};
const STATUS_TONE: Record<string, "warning" | "success" | "default"> = {
  open: "warning", closed: "success",
};

type DocRef = { refNo: string; title: string };
type OwnerSnapshot = { displayName?: string; orgUnitName?: string; phone?: string; email?: string };
type RegDoc = {
  _id: string;
  actionNo: string;
  regulator: string;
  actionType: string;
  subject: string;
  dueDate: string;
  responseDate?: string;
  status: string;
  projectSnapshot: { name: string; code: string } | null;
  ownerUserSnapshot: OwnerSnapshot | null;
  relatedDocumentRefs?: DocRef[];
};

export default function RegulatoryDetailPage() {
  const { actionId } = useParams<{ actionId: string }>();
  const { pushToast } = useToast();
  const [doc, setDoc] = useState<RegDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/regulatory/${actionId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [actionId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = async () => {
    if (!doc) return;
    const nextStatus = doc.status === "open" ? "closed" : "open";
    const label = nextStatus === "closed" ? "종결" : "재개";
    const res = await fetch(`/api/regulatory/${actionId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json();
    if (json.ok) { pushToast({ title: `${label} 처리됨`, description: "상태가 변경되었습니다.", tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  if (loading) return <StatePanel variant="loading" title="규제대응 로딩 중" description="규제대응 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/commissioning/regulatory" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Commissioning"
        title={doc.actionNo}
        description={doc.subject}
        meta={[
          { label: "Database", tone: "success" },
          { label: doc.status === "open" ? "대응중" : "종결", tone: STATUS_TONE[doc.status] ?? "default" },
        ]}
        actions={<>
          <Link href="/commissioning/regulatory" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          <PermissionLink permission="regulatory-action.update" href={`/commissioning/regulatory/${actionId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          {doc.status === "open"
            ? <PermissionButton permission="regulatory-action.update" onClick={toggleStatus} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">종결</PermissionButton>
            : <PermissionButton permission="regulatory-action.update" onClick={toggleStatus} className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white">재개</PermissionButton>
          }
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">대응 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="대응번호" value={<span className="font-mono">{doc.actionNo}</span>} />
            <DetailField label="상태" value={<StatusBadge label={doc.status === "open" ? "대응중" : "종결"} tone={STATUS_TONE[doc.status] ?? "default"} />} />
            <DetailField label="규제기관" value={doc.regulator} />
            <DetailField label="대응유형" value={TYPE_LABELS[doc.actionType] ?? doc.actionType} />
            <DetailField label="주제" value={doc.subject} />
            <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
            <DetailField label="기한" value={doc.dueDate || "-"} />
            <DetailField label="응답일" value={doc.responseDate || "-"} />
          </dl>
        </Panel>

        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">담당자</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="이름" value={doc.ownerUserSnapshot?.displayName || "-"} />
            <DetailField label="소속" value={doc.ownerUserSnapshot?.orgUnitName || "-"} />
            <DetailField label="연락처" value={doc.ownerUserSnapshot?.phone || "-"} />
            <DetailField label="이메일" value={
              doc.ownerUserSnapshot?.email
                ? <a href={`mailto:${doc.ownerUserSnapshot.email}`} className="text-[color:var(--primary)] hover:underline">{doc.ownerUserSnapshot.email}</a>
                : "-"
            } />
          </dl>
        </Panel>

        {(doc.relatedDocumentRefs ?? []).length > 0 && (
          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">관련 문서</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                  <tr>
                    {["문서번호", "제목"].map(h => (
                      <th key={h} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.relatedDocumentRefs!.map((ref, i) => (
                    <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                      <td className="px-4 py-2 font-mono text-xs">{ref.refNo}</td>
                      <td className="px-4 py-2">{ref.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
