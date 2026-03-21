"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { generateInspectionNo } from "@/lib/document-numbers";

type ProjectOption = { _id: string; code: string; name: string };
type SystemOption = { _id: string; code: string; name: string };

const INSPECTION_TYPE_OPTIONS = [
  { label: "외관검사", value: "외관검사" },
  { label: "치수검사", value: "치수검사" },
  { label: "비파괴검사", value: "비파괴검사" },
  { label: "수압시험", value: "수압시험" },
  { label: "기능시험", value: "기능시험" },
  { label: "전기검사", value: "전기검사" },
];

const RESULT_OPTIONS = [
  { label: "합격", value: "pass" },
  { label: "불합격", value: "fail" },
  { label: "조건부합격", value: "conditional" },
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

export default function InspectionNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const inspectionNo = useMemo(() => generateInspectionNo(), []);
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const systems = useSystems(selectedProject?._id ?? null);
  const [selectedSystem, setSelectedSystem] = useState<SystemOption | null>(null);
  const [form, setForm] = useState({
    inspectionType: "", inspectionDate: "", result: "pass", holdPoint: false, description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<"inspectionType" | "inspectionDate", string>>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.inspectionType) next.inspectionType = "검사유형을 선택해 주세요.";
    if (!form.inspectionDate) next.inspectionDate = "검사일을 입력해 주세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionNo,
          inspectionType: form.inspectionType,
          inspectionDate: form.inspectionDate,
          result: form.result,
          holdPoint: form.holdPoint,
          description: form.description.trim() || undefined,
          projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name } : null,
          systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name } : null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "검사 이력이 등록되었습니다.", tone: "success" });
        router.push(`/quality/inspections/${json.data._id}`);
      } else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Quality" title="검사 등록" description="새로운 검사 이력을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/quality/inspections" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">검사 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="검사번호" type="readonly" value={inspectionNo} />
            <DatePicker label="검사일" required value={form.inspectionDate} onChange={v => { setForm(p => ({ ...p, inspectionDate: v })); if (errors.inspectionDate) setErrors(p => ({ ...p, inspectionDate: undefined })); }} error={errors.inspectionDate} />
            <FormField label="검사유형" type="select" required value={form.inspectionType}
              onChange={v => { setForm(p => ({ ...p, inspectionType: v })); if (errors.inspectionType) setErrors(p => ({ ...p, inspectionType: undefined })); }}
              options={[{ label: "선택", value: "" }, ...INSPECTION_TYPE_OPTIONS]}
              error={errors.inspectionType} />
            <FormField label="결과" type="select" value={form.result}
              onChange={v => setForm(p => ({ ...p, result: v }))}
              options={RESULT_OPTIONS} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSystem(null); }}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <FormField label="계통" type="select" value={selectedSystem?._id ?? ""}
              onChange={id => setSelectedSystem(systems.find(s => s._id === id) ?? null)}
              options={(() => {
                const placeholder = !selectedProject ? "프로젝트를 먼저 선택하세요" : systems.length === 0 ? "등록된 계통이 없습니다" : "선택 안 함";
                return [{ label: placeholder, value: "" }, ...systems.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))];
              })()} />
            <div className="md:col-span-2 flex items-center gap-3">
              <label className="text-xs font-semibold text-[color:var(--text-muted)]">Hold Point</label>
              <button type="button" onClick={() => setForm(p => ({ ...p, holdPoint: !p.holdPoint }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.holdPoint ? "bg-[color:var(--warning)]" : "bg-[color:var(--border)]"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.holdPoint ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-[color:var(--text-muted)]">{form.holdPoint ? "Hold Point 지정됨" : "해당 없음"}</span>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">비고</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="검사 내용, 특이사항을 입력해 주세요." rows={3}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white resize-none" />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
