"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type ProjectOption = { _id: string; code: string; name: string };
type SystemOption = { _id: string; code: string; name: string };

const SEVERITY_OPTIONS = [
  { label: "경미", value: "minor" },
  { label: "중대", value: "major" },
  { label: "치명", value: "critical" },
];
const DISPOSITION_OPTIONS = [
  { label: "선택 안 함", value: "" },
  { label: "재작업", value: "rework" },
  { label: "수리", value: "repair" },
  { label: "폐기", value: "scrap" },
  { label: "특채", value: "accept-as-is" },
];
const STATUS_OPTIONS = [
  { label: "접수", value: "open" },
  { label: "조사중", value: "investigating" },
  { label: "처분중", value: "disposition" },
  { label: "종결", value: "closed" },
];

function useProjects() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(j => {
      if (j.ok) setProjects(j.data.items.map((p: ProjectOption & Record<string, unknown>) => ({ _id: p._id, code: p.code, name: p.name })));
    }).catch(() => {});
  }, []);
  return projects;
}

function useSystems(projectId: string | null) {
  const [systems, setSystems] = useState<SystemOption[]>([]);
  useEffect(() => {
    if (!projectId) { setSystems([]); return; }
    fetch(`/api/projects/${projectId}/systems`).then(r => r.json()).then(j => {
      if (j.ok) setSystems(j.data.items);
    }).catch(() => {});
  }, [projectId]);
  return systems;
}

export default function NcrEditPage() {
  const { ncrId } = useParams<{ ncrId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const projects = useProjects();
  const [ncrNo, setNcrNo] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const systems = useSystems(selectedProject?._id ?? null);
  const [selectedSystem, setSelectedSystem] = useState<SystemOption | null>(null);
  const [pendingSystemId, setPendingSystemId] = useState<string | null>(null);
  const [form, setForm] = useState({ severity: "minor", disposition: "", dueDate: "", description: "", status: "open" });
  const [errors, setErrors] = useState<Partial<Record<"severity", string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/ncrs/${ncrId}`).then(r => r.json()).then(json => {
      if (json.ok) {
        const d = json.data;
        setNcrNo(d.ncrNo ?? "");
        setForm({
          severity: d.severity ?? "minor",
          disposition: d.disposition ?? "",
          dueDate: d.dueDate ?? "",
          description: d.description ?? "",
          status: d.status ?? "open",
        });
        if (d.projectSnapshot?.projectId) {
          setSelectedProject({ _id: d.projectSnapshot.projectId, code: d.projectSnapshot.code, name: d.projectSnapshot.name });
        }
        if (d.systemSnapshot?.systemId) setPendingSystemId(d.systemSnapshot.systemId);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [ncrId]);

  useEffect(() => {
    if (pendingSystemId && systems.length > 0) {
      const found = systems.find(s => s._id === pendingSystemId);
      if (found) setSelectedSystem(found);
    }
  }, [systems, pendingSystemId]);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.severity) next.severity = "심각도를 선택해 주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ncrs/${ncrId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity: form.severity,
          disposition: form.disposition || undefined,
          dueDate: form.dueDate || undefined,
          description: form.description.trim() || undefined,
          status: form.status,
          projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name } : null,
          systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name } : null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "NCR이 수정되었습니다.", tone: "success" });
        router.push(`/quality/ncr/${ncrId}`);
      } else pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="NCR 정보를 불러오고 있습니다." />;

  return (
    <>
      <PageHeader eyebrow="Quality" title="NCR 수정" description={ncrNo}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/quality/ncr/${ncrId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">NCR 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="NCR번호" type="readonly" value={ncrNo} />
            <FormField label="상태" type="select" value={form.status}
              onChange={v => setForm(p => ({ ...p, status: v }))} options={STATUS_OPTIONS} />
            <FormField label="심각도" type="select" required value={form.severity}
              onChange={v => { setForm(p => ({ ...p, severity: v })); if (errors.severity) setErrors(p => ({ ...p, severity: undefined })); }}
              options={SEVERITY_OPTIONS} error={errors.severity} />
            <FormField label="처분" type="select" value={form.disposition}
              onChange={v => setForm(p => ({ ...p, disposition: v }))} options={DISPOSITION_OPTIONS} />
            <DatePicker label="기한" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSystem(null); setPendingSystemId(null); }}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <FormField label="계통" type="select" value={selectedSystem?._id ?? ""}
              onChange={id => setSelectedSystem(systems.find(s => s._id === id) ?? null)}
              options={(() => {
                const placeholder = !selectedProject ? "프로젝트를 먼저 선택하세요" : systems.length === 0 ? "등록된 계통이 없습니다" : "선택 안 함";
                return [{ label: placeholder, value: "" }, ...systems.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))];
              })()} />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">설명</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="NCR 내용, 부적합 사항" rows={3}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white resize-none" />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
