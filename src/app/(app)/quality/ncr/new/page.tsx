"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { generateNcrNo } from "@/lib/document-numbers";

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

function useCurrentUser() {
  const [user, setUser] = useState<{ displayName: string; orgUnitName: string; email: string } | null>(null);
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(j => { if (j.ok) setUser(j.data); }).catch(() => {});
  }, []);
  return user;
}

export default function NcrNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const ncrNo = useMemo(() => generateNcrNo(), []);
  const projects = useProjects();
  const currentUser = useCurrentUser();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const systems = useSystems(selectedProject?._id ?? null);
  const [selectedSystem, setSelectedSystem] = useState<SystemOption | null>(null);
  const [form, setForm] = useState({
    severity: "minor", disposition: "", dueDate: "", description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<"severity", string>>>({});
  const [saving, setSaving] = useState(false);

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
      const res = await fetch("/api/ncrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncrNo,
          severity: form.severity,
          disposition: form.disposition || undefined,
          dueDate: form.dueDate || undefined,
          description: form.description.trim() || undefined,
          projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name } : null,
          systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name } : null,
          ownerUserSnapshot: currentUser ? { displayName: currentUser.displayName, orgUnitName: currentUser.orgUnitName, email: currentUser.email } : null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "NCR이 등록되었습니다.", tone: "success" });
        router.push(`/quality/ncr/${json.data._id}`);
      } else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Quality" title="NCR 등록" description="새로운 부적합 보고서를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/quality/ncr" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">NCR 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="NCR번호" type="readonly" value={ncrNo} />
            <FormField label="심각도" type="select" required value={form.severity}
              onChange={v => { setForm(p => ({ ...p, severity: v })); if (errors.severity) setErrors(p => ({ ...p, severity: undefined })); }}
              options={SEVERITY_OPTIONS} error={errors.severity} />
            <FormField label="처분" type="select" value={form.disposition}
              onChange={v => setForm(p => ({ ...p, disposition: v }))} options={DISPOSITION_OPTIONS} />
            <DatePicker label="기한" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSystem(null); }}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <FormField label="계통" type="select" value={selectedSystem?._id ?? ""}
              onChange={id => setSelectedSystem(systems.find(s => s._id === id) ?? null)}
              options={(() => {
                const placeholder = !selectedProject ? "프로젝트를 먼저 선택하세요" : systems.length === 0 ? "등록된 계통이 없습니다" : "선택 안 함";
                return [{ label: placeholder, value: "" }, ...systems.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))];
              })()} />
            <FormField label="담당자" type="readonly" value={currentUser?.displayName ?? ""} />
            <FormField label="소속" type="readonly" value={currentUser?.orgUnitName ?? ""} />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">설명</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="NCR 내용, 부적합 사항을 입력해 주세요." rows={3}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white resize-none" />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
