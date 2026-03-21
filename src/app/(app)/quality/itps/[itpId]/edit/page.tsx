"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

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

export default function ItpEditPage() {
  const { itpId } = useParams<{ itpId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const systems = useSystems(selectedProject?._id ?? null);
  const [selectedSystem, setSelectedSystem] = useState<SystemOption | null>(null);
  const [pendingSystemId, setPendingSystemId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [revisionNo, setRevisionNo] = useState(0);
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/itps/${itpId}`).then(r => r.json()).then(json => {
      if (json.ok) {
        const d = json.data;
        setCode(d.code ?? "");
        setName(d.name ?? "");
        setRevisionNo((typeof d.revisionNo === "number" ? d.revisionNo : 0) + 1);
        if (d.projectSnapshot?.projectId) {
          setSelectedProject({ _id: d.projectSnapshot.projectId, code: d.projectSnapshot.code, name: d.projectSnapshot.name });
        }
        if (d.systemSnapshot?.systemId) setPendingSystemId(d.systemSnapshot.systemId);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [itpId]);

  useEffect(() => {
    if (pendingSystemId && systems.length > 0) {
      const found = systems.find(s => s._id === pendingSystemId);
      if (found) setSelectedSystem(found);
    }
  }, [systems, pendingSystemId]);

  const handleSubmit = async () => {
    if (!name.trim()) { setNameError("ITP명을 입력해 주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/itps/${itpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          revisionNo,
          projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name } : null,
          systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name } : null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "ITP가 수정되었습니다.", tone: "success" });
        router.push(`/quality/itps/${itpId}`);
      } else pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  if (loading) return <StatePanel variant="loading" title="로딩 중" description="ITP 정보를 불러오고 있습니다." />;

  return (
    <>
      <PageHeader eyebrow="Quality" title="ITP 수정" description={code}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/quality/itps/${itpId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <Panel className="p-5 max-w-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="ITP 코드" type="readonly" value={code} />
          <FormField label="Rev." type="readonly" value={`Rev.${revisionNo}`} />
          <div className="md:col-span-2">
            <FormField label="ITP명" required value={name}
              onChange={v => { setName(v); if (nameError) setNameError(""); }}
              placeholder="ITP 명칭" error={nameError} />
          </div>
          <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
            onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSystem(null); setPendingSystemId(null); }}
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
