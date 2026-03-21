"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { generateItpCode } from "@/lib/document-numbers";

type ProjectOption = { _id: string; code: string; name: string };
type SystemOption = { _id: string; code: string; name: string };

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

export default function ItpNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const code = useMemo(() => generateItpCode(), []);
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const systems = useSystems(selectedProject?._id ?? null);
  const [selectedSystem, setSelectedSystem] = useState<SystemOption | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { setNameError("ITP명을 입력해 주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/itps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: name.trim(),
          revisionNo: 0,
          projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name } : null,
          systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name } : null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "ITP가 등록되었습니다.", tone: "success" });
        router.push(`/quality/itps/${json.data._id}`);
      } else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Quality" title="ITP 등록" description="새로운 검사시험계획서를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/quality/itps" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <Panel className="p-5 max-w-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="ITP 코드" type="readonly" value={code} />
          <FormField label="Rev." type="readonly" value="Rev.0" />
          <div className="md:col-span-2">
            <FormField label="ITP명" required value={name}
              onChange={v => { setName(v); if (nameError) setNameError(""); }}
              placeholder="ITP 명칭" error={nameError} />
          </div>
          <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
            onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSystem(null); }}
            options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
          <FormField label="계통" type="select" value={selectedSystem?._id ?? ""}
            onChange={id => setSelectedSystem(systems.find(s => s._id === id) ?? null)}
            options={(() => {
              const placeholder = !selectedProject ? "프로젝트를 먼저 선택하세요" : systems.length === 0 ? "등록된 계통이 없습니다" : "선택 안 함";
              return [{ label: placeholder, value: "" }, ...systems.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))];
            })()} />
        </div>
      </Panel>
    </>
  );
}
