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
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import {
  INCIDENT_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_TONE,
  STATUS_LABELS, STATUS_TONE,
} from "../_shared";
import { DatePicker } from "@/components/ui/date-picker";
import { canAccessAction } from "@/lib/navigation";

type CorrectiveAction = { code: string; description: string; dueDate: string; status: string };
type IncidentDoc = {
  _id: string;
  incidentNo: string;
  incidentType: string;
  severity: string;
  title: string;
  occurredAt: string;
  site?: string;
  description?: string;
  status: string;
  projectSnapshot: { code: string; name: string } | null;
  siteSnapshot: { code: string; name: string } | null;
  ownerUserSnapshot: { displayName?: string; orgUnitName?: string; phone?: string; email?: string } | null;
  correctiveActions: CorrectiveAction[];
};

const CA_TONE: Record<string, "danger" | "success"> = { open: "danger", closed: "success" };
const CA_LABELS: Record<string, string> = { open: "미결", closed: "완료" };

export default function HseDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<IncidentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [caItems, setCaItems] = useState<CorrectiveAction[]>([]);
  const [caCode, setCaCode] = useState("");
  const [caDesc, setCaDesc] = useState("");
  const [caDue, setCaDue] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hse/${incidentId}`);
      const json = await res.json();
      if (json.ok) {
        setDoc(json.data);
        setCaItems(json.data.correctiveActions ?? []);
      } else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [incidentId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const putField = async (fields: Record<string, unknown>) => {
    const res = await fetch(`/api/hse/${incidentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    return res.json();
  };

  const changeStatus = async (next: string, label: string) => {
    const json = await putField({ status: next });
    if (json.ok) { pushToast({ title: label, description: "상태가 변경되었습니다.", tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const addCa = async () => {
    if (!caCode.trim() || !caDesc.trim()) return;
    const next = [...caItems, { code: caCode.trim(), description: caDesc.trim(), dueDate: caDue, status: "open" }];
    const json = await putField({ correctiveActions: next });
    if (json.ok) { setCaItems(next); setCaCode(""); setCaDesc(""); setCaDue(""); pushToast({ title: "추가됨", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const toggleCa = async (i: number) => {
    const next = caItems.map((c, idx) => idx === i ? { ...c, status: c.status === "open" ? "closed" : "open" } : c);
    const json = await putField({ correctiveActions: next });
    if (json.ok) { setCaItems(next); pushToast({ title: "상태 변경", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const handleDelete = async () => {
    if (!window.confirm("이 사고를 삭제하시겠습니까? 삭제된 사고는 목록에서 제외됩니다.")) return;
    const res = await fetch(`/api/hse/${incidentId}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      pushToast({ title: "삭제 완료", description: "HSE 사고가 삭제되었습니다.", tone: "success" });
      router.push("/safety/hse");
    } else pushToast({ title: "삭제 실패", description: json.message, tone: "warning" });
  };

  const deleteCa = async (i: number) => {
    const next = caItems.filter((_, idx) => idx !== i);
    const json = await putField({ correctiveActions: next });
    if (json.ok) { setCaItems(next); pushToast({ title: "삭제됨", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  if (loading) return <StatePanel variant="loading" title="HSE 사고 로딩 중" description="사고 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/safety/hse" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const openCaCount = caItems.filter(c => c.status === "open").length;
  const canUpdateHse = canAccessAction(viewerPermissions, "hse.update");
  const canArchiveHse = canAccessAction(viewerPermissions, "hse.archive");

  return (
    <>
      <PageHeader
        eyebrow="Safety"
        title={doc.incidentNo}
        description={doc.title}
        meta={[
          { label: "Database", tone: "success" },
          { label: STATUS_LABELS[doc.status] ?? doc.status, tone: STATUS_TONE[doc.status] ?? "warning" },
          { label: INCIDENT_TYPE_LABELS[doc.incidentType] ?? doc.incidentType, tone: "default" },
          ...(openCaCount > 0 ? [{ label: `시정조치 ${openCaCount}건`, tone: "warning" as const }] : []),
        ]}
        actions={<>
          <Link href="/safety/hse" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canArchiveHse ? (
            <PermissionButton permission="hse.archive" onClick={() => void handleDelete()} className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">삭제</PermissionButton>
          ) : null}
          {canUpdateHse ? (
            <PermissionLink permission="hse.update" href={`/safety/hse/${incidentId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {doc.status === "open" && (
            <PermissionButton permission="hse.update" onClick={() => changeStatus("investigating", "조사 시작")} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">조사 시작</PermissionButton>
          )}
          {doc.status === "investigating" && (
            <PermissionButton permission="hse.update" onClick={() => changeStatus("closed", "종결")} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">종결</PermissionButton>
          )}
          {doc.status === "closed" && (
            <PermissionButton permission="hse.update" onClick={() => changeStatus("open", "재개")} className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white">재개</PermissionButton>
          )}
        </>}
      />

      <Tabs
        items={[
          { value: "overview", label: "개요", caption: "사고 정보 및 담당자" },
          { value: "ca", label: "시정조치", count: openCaCount, caption: "미결 시정조치" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="mb-6 2xl:grid-cols-2"
      />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">사고 정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="사고번호" value={<span className="font-mono">{doc.incidentNo}</span>} />
              <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[doc.status] ?? doc.status} tone={STATUS_TONE[doc.status] ?? "warning"} />} />
              <DetailField label="유형" value={INCIDENT_TYPE_LABELS[doc.incidentType] ?? doc.incidentType} />
              <DetailField label="심각도" value={<StatusBadge label={SEVERITY_LABELS[doc.severity] ?? doc.severity} tone={SEVERITY_TONE[doc.severity] ?? "default"} />} />
              <DetailField label="발생일" value={doc.occurredAt || "-"} />
              <DetailField label="발생 현장" value={doc.siteSnapshot ? `${doc.siteSnapshot.code} · ${doc.siteSnapshot.name}` : "-"} />
              <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
              {doc.description && <DetailField label="상세 내용" value={doc.description} />}
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
        </div>
      )}

      {activeTab === "ca" && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--text)]">시정조치</h3>
            <span className="text-xs text-[color:var(--text-muted)]">미결 {openCaCount}건 / 전체 {caItems.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                <tr>
                  {["코드", "내용", "기한", "상태", ""].map((h, i) => (
                    <th key={i} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caItems.map((c, i) => (
                  <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2">{c.description}</td>
                    <td className="px-4 py-2 text-xs">{c.dueDate || "-"}</td>
                    <td className="px-4 py-2"><StatusBadge label={CA_LABELS[c.status] ?? c.status} tone={CA_TONE[c.status] ?? "default"} /></td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        {canUpdateHse ? (
                          <button onClick={() => void toggleCa(i)}
                            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]">
                            {c.status === "open" ? "완료" : "재개"}
                          </button>
                        ) : null}
                        {canUpdateHse ? (
                          <button onClick={() => void deleteCa(i)}
                            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {caItems.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">등록된 시정조치가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input value={caCode} onChange={e => setCaCode(e.target.value)} placeholder="코드 (예: CA-001)"
              className="w-36 shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white" />
            <input value={caDesc} onChange={e => setCaDesc(e.target.value)} placeholder="시정조치 내용"
              onKeyDown={e => { if (e.key === "Enter") void addCa(); }}
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white" />
            <DatePicker label="" value={caDue} onChange={v => setCaDue(v)} className="w-36 shrink-0" />
            {canUpdateHse ? (
              <button onClick={() => void addCa()}
                className="shrink-0 rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                + 추가
              </button>
            ) : null}
          </div>
        </Panel>
      )}
    </>
  );
}
