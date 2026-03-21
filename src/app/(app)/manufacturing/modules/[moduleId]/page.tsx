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
import { DatePicker } from "@/components/ui/date-picker";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";

const MODULE_TYPE_LABELS: Record<string, string> = {
  reactor: "원자로", turbine: "터빈", auxiliary: "보조", bop: "BOP",
  "reactor-skid": "원자로 스키드", "control-rack": "제어 랙",
  "offshore-skid": "해상 스키드", "support-frame": "지지 구조물",
  "pilot-loop": "파일럿 루프", "turbine-generator": "터빈 발전기",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "계획", fabricating: "제작중", testing: "검수 중",
  rework: "재작업", shipped: "출하", installed: "설치완료",
};

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planned: "default", fabricating: "info", testing: "warning",
  rework: "danger", shipped: "info", installed: "success",
};

type ModuleDoc = {
  _id: string; moduleNo: string; moduleType: string; serialNo: string; status: string;
  installationDate: string | null; createdAt: string; updatedAt: string;
  projectSnapshot: { projectId: string; code: string; name: string; projectType: string } | null;
  systemSnapshot: { systemId: string; code: string; name: string; discipline: string } | null;
  manufacturerSnapshot: { partyId?: string; manufacturerId?: string; code: string; name: string } | null;
  components?: { itemNo?: string; partNo?: string; description: string; serialNo?: string; specification?: string; status?: string }[];
};

export default function ModuleDetailPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<ModuleDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 제작 시작 모달
  const [fabModal, setFabModal] = useState(false);
  const [fabDates, setFabDates] = useState({ plannedStartDate: "", plannedEndDate: "" });
  const [fabSaving, setFabSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [moduleId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runStatusChange = async (action: string, label: string) => {
    const res = await fetch("/api/manufacturing/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetIds: [moduleId] }),
    });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: "상태가 변경되었습니다.", tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const handleFabConfirm = async () => {
    if (!fabDates.plannedStartDate || !fabDates.plannedEndDate) {
      pushToast({ title: "필수 입력", description: "계획 시작일과 종료일을 입력해 주세요.", tone: "warning" });
      return;
    }
    if (!doc) return;
    setFabSaving(true);
    try {
      const res = await fetch("/api/manufacturing-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleSnapshot: { moduleId: doc._id, moduleNo: doc.moduleNo, moduleType: doc.moduleType, serialNo: doc.serialNo },
          projectSnapshot: doc.projectSnapshot ?? null,
          vendorSnapshot: doc.manufacturerSnapshot ? {
            partyId: doc.manufacturerSnapshot.partyId ?? doc.manufacturerSnapshot.manufacturerId ?? "",
            code: doc.manufacturerSnapshot.code,
            name: doc.manufacturerSnapshot.name,
          } : null,
          plannedStartDate: fabDates.plannedStartDate,
          plannedEndDate: fabDates.plannedEndDate,
          quantity: 1,
          status: "in-progress",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "제작 시작", description: "제작지시가 등록되고 상태가 변경되었습니다.", tone: "success" });
        setFabModal(false);
        setFabDates({ plannedStartDate: "", plannedEndDate: "" });
        fetchData();
      } else {
        pushToast({ title: "실패", description: json.message, tone: "warning" });
      }
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setFabSaving(false); }
  };

  if (loading) return <StatePanel variant="loading" title="모듈 로딩 중" description="모듈 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/manufacturing/modules" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const status = doc.status;
  const canUpdateModule = canAccessAction(viewerPermissions, "module.update");

  const actionButtons = (
    <>
      {(status === "planned" || status === "rework") && (
        <PermissionButton permission="manufacturing-order.create" onClick={() => { setFabDates({ plannedStartDate: "", plannedEndDate: "" }); setFabModal(true); }}
          className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
          제작 시작
        </PermissionButton>
      )}
      {status === "fabricating" && (
        <PermissionButton permission="module.update" onClick={() => runStatusChange("start-testing", "검수 시작")}
          className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white">
          검수 시작
        </PermissionButton>
      )}
      {status === "testing" && (
        <PermissionButton permission="module.update" onClick={() => runStatusChange("ship", "출하 처리")}
          className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">
          출하 처리
        </PermissionButton>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Manufacturing"
        title={doc.moduleNo}
        description={MODULE_TYPE_LABELS[doc.moduleType] ?? doc.moduleType}
        meta={[{ label: "Database", tone: "success" }, { label: STATUS_LABELS[status] ?? status, tone: statusTone[status] ?? "default" }]}
        actions={
          <>
            <Link href="/manufacturing/modules" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
            {canUpdateModule ? (
              <PermissionLink permission="module.update" href={`/manufacturing/modules/${moduleId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
            ) : null}
            {actionButtons}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">모듈 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="모듈번호" value={<span className="font-mono">{doc.moduleNo}</span>} />
            <DetailField label="유형" value={MODULE_TYPE_LABELS[doc.moduleType] ?? doc.moduleType} />
            <DetailField label="S/N" value={doc.serialNo || "-"} />
            <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[status] ?? status} tone={statusTone[status] ?? "default"} />} />
            <DetailField label="설치 예정일" value={doc.installationDate ?? "-"} />
          </dl>
        </Panel>

        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">연결 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.name} (${doc.projectSnapshot.code})` : "-"} />
            <DetailField label="계통" value={doc.systemSnapshot ? `${doc.systemSnapshot.name} (${doc.systemSnapshot.code})` : "-"} />
            <DetailField label="제작사" value={doc.manufacturerSnapshot?.name ?? "-"} />
          </dl>
        </Panel>

        {doc.components && doc.components.length > 0 && (
          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">구성 부품</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                  <tr>
                    {["No.", "Part No.", "설명", "S/N", "사양", "상태"].map(h => (
                      <th key={h} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold tracking-[0.12em] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.components.map((c, i) => (
                    <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                      <td className="px-4 py-2">{c.itemNo ?? c.partNo ?? "-"}</td>
                      <td className="px-4 py-2 font-mono">{c.partNo ?? "-"}</td>
                      <td className="px-4 py-2">{c.description}</td>
                      <td className="px-4 py-2 font-mono">{c.serialNo ?? "-"}</td>
                      <td className="px-4 py-2">{c.specification ?? "-"}</td>
                      <td className="px-4 py-2">{c.status ? <StatusBadge label={c.status} tone="default" /> : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {/* 제작 시작 날짜 입력 모달 */}
      {fabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFabModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-1 text-base font-semibold text-[color:var(--text)]">제작 시작</h2>
            <p className="mb-5 text-sm text-[color:var(--text-muted)]">{doc.moduleNo} 제작지시를 등록합니다.</p>
            <div className="grid gap-4">
              <DatePicker label="계획 시작일" required value={fabDates.plannedStartDate} onChange={v => setFabDates(prev => ({ ...prev, plannedStartDate: v }))} />
              <DatePicker label="계획 종료일" required value={fabDates.plannedEndDate} onChange={v => setFabDates(prev => ({ ...prev, plannedEndDate: v }))} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setFabModal(false)} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</button>
              <button onClick={handleFabConfirm} disabled={fabSaving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {fabSaving ? "처리 중..." : "제작 시작"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 뒤로가기 */}
      <div className="mt-2">
        <button onClick={() => router.back()} className="text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]">← 이전으로</button>
      </div>
    </>
  );
}
