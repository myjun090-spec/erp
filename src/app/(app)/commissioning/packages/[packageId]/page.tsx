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
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";

const STATUS_LABELS: Record<string, string> = {
  planned: "계획", "in-progress": "진행중", "mc-complete": "MC 완료",
  "comm-complete": "시운전 완료", "handed-over": "인계 완료",
};
const STATUS_TONE: Record<string, "default" | "info" | "warning" | "success"> = {
  planned: "default", "in-progress": "info", "mc-complete": "warning",
  "comm-complete": "success", "handed-over": "success",
};
const PUNCH_TONE: Record<string, "default" | "success" | "danger" | "warning"> = {
  open: "danger", closed: "success", "in-progress": "warning",
};
const PUNCH_LABELS: Record<string, string> = { open: "미결", closed: "완료", "in-progress": "진행중" };
const TURNOVER_STATUS_OPTIONS = [
  { label: "계획", value: "planned" },
  { label: "준비중", value: "preparing" },
  { label: "MC 준비완료", value: "ready-for-mc" },
  { label: "MC 완료", value: "mc-complete" },
];

type PunchItem = { code: string; title: string; status: string };
type TestItem = { code: string; title: string };
type Turnover = { status: string; dossierNo: string };
type PkgDoc = {
  _id: string; packageNo: string; status: string;
  subsystemName: string; description?: string;
  projectSnapshot: { projectId: string; code: string; name: string } | null;
  unitSnapshot: { unitId: string; unitNo: string } | null;
  systemSnapshot: { systemId: string; code: string; name: string; discipline: string } | null;
  punchItems: PunchItem[];
  testItems: TestItem[];
  turnover: Turnover | null;
  handoverDate?: string;
};

export default function CommPackageDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<PkgDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [punchCode, setPunchCode] = useState("");
  const [punchTitle, setPunchTitle] = useState("");

  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [testCode, setTestCode] = useState("");
  const [testTitle, setTestTitle] = useState("");

  const [toverDossier, setToverDossier] = useState("");
  const [toverStatus, setToverStatus] = useState("planned");
  const [toverSaving, setToverSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commissioning-packages/${packageId}`);
      const json = await res.json();
      if (json.ok) {
        setDoc(json.data);
        setPunchItems(json.data.punchItems ?? []);
        setTestItems(json.data.testItems ?? []);
        setToverDossier(json.data.turnover?.dossierNo ?? "");
        setToverStatus(json.data.turnover?.status ?? "planned");
      } else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [packageId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runAction = async (action: string, label: string) => {
    const res = await fetch("/api/commissioning/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetIds: [packageId] }),
    });
    const json = await res.json();
    if (json.ok) { pushToast({ title: label, description: "처리되었습니다.", tone: "success" }); fetchData(); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const putField = async (fields: Record<string, unknown>) => {
    const res = await fetch(`/api/commissioning-packages/${packageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    return res.json();
  };

  const addPunch = async () => {
    if (!punchCode.trim() || !punchTitle.trim()) return;
    const next = [...punchItems, { code: punchCode.trim(), title: punchTitle.trim(), status: "open" }];
    const json = await putField({ punchItems: next });
    if (json.ok) { setPunchItems(next); setPunchCode(""); setPunchTitle(""); pushToast({ title: "추가됨", description: "Punch Item이 추가되었습니다.", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const togglePunch = async (i: number) => {
    const item = punchItems[i];
    const next = punchItems.map((p, idx) => idx === i ? { ...p, status: p.status === "open" ? "closed" : "open" } : p);
    const json = await putField({ punchItems: next });
    if (json.ok) { setPunchItems(next); pushToast({ title: item.status === "open" ? "완료 처리" : "재개", description: "상태가 변경되었습니다.", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const deletePunch = async (i: number) => {
    const next = punchItems.filter((_, idx) => idx !== i);
    const json = await putField({ punchItems: next });
    if (json.ok) { setPunchItems(next); pushToast({ title: "삭제됨", description: "Punch Item이 삭제되었습니다.", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const addTest = async () => {
    if (!testCode.trim() || !testTitle.trim()) return;
    const next = [...testItems, { code: testCode.trim(), title: testTitle.trim() }];
    const json = await putField({ testItems: next });
    if (json.ok) { setTestItems(next); setTestCode(""); setTestTitle(""); pushToast({ title: "추가됨", description: "Test Item이 추가되었습니다.", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const deleteTest = async (i: number) => {
    const next = testItems.filter((_, idx) => idx !== i);
    const json = await putField({ testItems: next });
    if (json.ok) { setTestItems(next); pushToast({ title: "삭제됨", description: "Test Item이 삭제되었습니다.", tone: "success" }); }
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  const saveTurnover = async () => {
    setToverSaving(true);
    const json = await putField({ turnover: { dossierNo: toverDossier.trim(), status: toverStatus } });
    setToverSaving(false);
    if (json.ok) pushToast({ title: "저장됨", description: "Turnover가 업데이트되었습니다.", tone: "success" });
    else pushToast({ title: "오류", description: json.message, tone: "warning" });
  };

  if (loading) return <StatePanel variant="loading" title="패키지 로딩 중" description="패키지 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/commissioning/packages" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const openPunchCount = punchItems.filter(p => p.status === "open").length;
  const canUpdatePackage = canAccessAction(viewerPermissions, "commissioning-package.update");
  const canApprovePackage = canAccessAction(viewerPermissions, "commissioning-package.approve");

  return (
    <>
      <PageHeader
        eyebrow="Commissioning"
        title={doc.packageNo}
        description={doc.projectSnapshot ? `${doc.projectSnapshot.name} · ${doc.subsystemName}` : doc.subsystemName}
        meta={[
          { label: "Database", tone: "success" },
          { label: STATUS_LABELS[doc.status] ?? doc.status, tone: STATUS_TONE[doc.status] ?? "default" },
          ...(openPunchCount > 0 ? [{ label: `Punch ${openPunchCount}건`, tone: "warning" as const }] : []),
        ]}
        actions={<>
          <Link href="/commissioning/packages" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          <PermissionLink permission="commissioning-package.update" href={`/commissioning/packages/${packageId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          {doc.status === "planned" && canApprovePackage && (
            <PermissionButton permission="commissioning-package.approve" onClick={() => runAction("start", "작업 시작")} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">작업 시작</PermissionButton>
          )}
          {doc.status === "in-progress" && canApprovePackage && (
            <PermissionButton permission="commissioning-package.approve" onClick={() => runAction("mc-complete", "MC 완료")} className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white">MC 완료</PermissionButton>
          )}
          {doc.status === "mc-complete" && canApprovePackage && (
            <PermissionButton permission="commissioning-package.approve" onClick={() => runAction("comm-complete", "시운전 완료")} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">시운전 완료</PermissionButton>
          )}
          {doc.status === "comm-complete" && canApprovePackage && (
            <PermissionButton permission="commissioning-package.approve" onClick={() => runAction("handover", "인계")} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">인계</PermissionButton>
          )}
        </>}
      />

      <Tabs
        items={[
          { value: "overview", label: "개요", caption: "기본 정보 및 Turnover" },
          { value: "punch", label: "Punch Items", count: openPunchCount, caption: "미결 펀치 아이템" },
          { value: "test", label: "Test Items", count: testItems.length, caption: "테스트 항목" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        className="mb-6 2xl:grid-cols-3"
      />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">패키지 정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="패키지번호" value={<span className="font-mono">{doc.packageNo}</span>} />
              <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[doc.status] ?? doc.status} tone={STATUS_TONE[doc.status] ?? "default"} />} />
              <DetailField label="서브시스템" value={doc.subsystemName || "-"} />
              <DetailField label="인계일" value={doc.handoverDate || "-"} />
              {doc.description && <DetailField label="설명" value={doc.description} />}
            </dl>
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">프로젝트 연결</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.code} · ${doc.projectSnapshot.name}` : "-"} />
              <DetailField label="유닛" value={doc.unitSnapshot?.unitNo ?? "-"} />
              <DetailField label="계통" value={doc.systemSnapshot ? `${doc.systemSnapshot.code} · ${doc.systemSnapshot.name}` : "-"} />
              <DetailField label="분야" value={doc.systemSnapshot?.discipline ?? "-"} />
            </dl>
          </Panel>

          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">Turnover</h3>
            <div className="grid gap-4 md:grid-cols-3 items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">Dossier No.</label>
                <input
                  value={toverDossier}
                  onChange={e => setToverDossier(e.target.value)}
                  readOnly={!canUpdatePackage}
                  placeholder="TO-001"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">상태</label>
                <select
                  value={toverStatus}
                  onChange={e => setToverStatus(e.target.value)}
                  disabled={!canUpdatePackage}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
                >
                  {TURNOVER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <PermissionButton
                permission="commissioning-package.update"
                onClick={saveTurnover}
                disabled={toverSaving || !canUpdatePackage}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {toverSaving ? "저장 중..." : "저장"}
              </PermissionButton>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === "punch" && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--text)]">Punch Items</h3>
            <span className="text-xs text-[color:var(--text-muted)]">미결 {openPunchCount}건 / 전체 {punchItems.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                <tr>
                  {["코드", "내용", "상태", ""].map((h, i) => (
                    <th key={i} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {punchItems.map((p, i) => (
                  <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2">{p.title}</td>
                    <td className="px-4 py-2"><StatusBadge label={PUNCH_LABELS[p.status] ?? p.status} tone={PUNCH_TONE[p.status] ?? "default"} /></td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <PermissionButton permission="commissioning-package.update" onClick={() => togglePunch(i)}
                          disabled={!canUpdatePackage}
                          className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]">
                          {p.status === "open" ? "완료" : "재개"}
                        </PermissionButton>
                        <PermissionButton permission="commissioning-package.update" onClick={() => deletePunch(i)}
                          disabled={!canUpdatePackage}
                          className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">
                          삭제
                        </PermissionButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {punchItems.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">등록된 Punch Item이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={punchCode}
              onChange={e => setPunchCode(e.target.value)}
              readOnly={!canUpdatePackage}
              placeholder="코드 (예: P-001)"
              className="w-36 shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
            />
            <input
              value={punchTitle}
              onChange={e => setPunchTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canUpdatePackage) void addPunch(); }}
              readOnly={!canUpdatePackage}
              placeholder="Punch Item 내용"
              className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
            />
            <PermissionButton permission="commissioning-package.update" onClick={() => void addPunch()}
              disabled={!canUpdatePackage}
              className="shrink-0 rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              + 추가
            </PermissionButton>
          </div>
        </Panel>
      )}

      {activeTab === "test" && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--text)]">Test Items</h3>
            <span className="text-xs text-[color:var(--text-muted)]">전체 {testItems.length}건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                <tr>
                  {["코드", "내용", ""].map((h, i) => (
                    <th key={i} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testItems.map((t, i) => (
                  <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2 text-right">
                      <PermissionButton permission="commissioning-package.update" onClick={() => void deleteTest(i)}
                        disabled={!canUpdatePackage}
                        className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">
                        삭제
                      </PermissionButton>
                    </td>
                  </tr>
                ))}
                {testItems.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">등록된 Test Item이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={testCode}
              onChange={e => setTestCode(e.target.value)}
              readOnly={!canUpdatePackage}
              placeholder="코드 (예: T-001)"
              className="w-36 shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
            />
            <input
              value={testTitle}
              onChange={e => setTestTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canUpdatePackage) void addTest(); }}
              readOnly={!canUpdatePackage}
              placeholder="Test Item 내용"
              className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
            />
            <PermissionButton permission="commissioning-package.update" onClick={() => void addTest()}
              disabled={!canUpdatePackage}
              className="shrink-0 rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              + 추가
            </PermissionButton>
          </div>
        </Panel>
      )}
    </>
  );
}
