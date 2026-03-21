"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type ProjectItem = { _id: string; code: string; name: string; projectType: string };
type UnitItem = { _id: string; unitNo: string };
type SystemItem = { _id: string; code: string; name: string; discipline: string; unitSnapshot?: { unitId: string; unitNo: string } | null };

const STATUS_OPTIONS = [
  { label: "계획", value: "planned" },
  { label: "진행중", value: "in-progress" },
  { label: "MC 완료", value: "mc-complete" },
  { label: "시운전 완료", value: "comm-complete" },
  { label: "인계 완료", value: "handed-over" },
];

export default function CommPackageEditPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemItem | null>(null);
  const [packageNo, setPackageNo] = useState("");
  const [form, setForm] = useState({ subsystemName: "", status: "planned", description: "" });
  const [saving, setSaving] = useState(false);

  const loadProjectDetail = async (projectId: string, unitId?: string, systemId?: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const json = await res.json();
      if (!json.ok) return;
      const fetchedUnits: UnitItem[] = (json.data._units ?? []).map((u: UnitItem & Record<string, unknown>) => ({ _id: u._id, unitNo: u.unitNo }));
      const fetchedSystems: SystemItem[] = (json.data._systems ?? []).map((s: SystemItem & Record<string, unknown>) => ({ _id: s._id, code: s.code as string, name: s.name as string, discipline: s.discipline as string, unitSnapshot: s.unitSnapshot as SystemItem["unitSnapshot"] }));
      setUnits(fetchedUnits);
      setSystems(fetchedSystems);
      if (unitId) setSelectedUnit(fetchedUnits.find(u => u._id === unitId) ?? null);
      if (systemId) setSelectedSystem(fetchedSystems.find(s => s._id === systemId) ?? null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const init = async () => {
      const [projRes, docRes] = await Promise.all([
        fetch("/api/projects").then(r => r.json()),
        fetch(`/api/commissioning-packages/${packageId}`).then(r => r.json()),
      ]);
      if (projRes.ok) setProjects(projRes.data.items.map((p: ProjectItem & Record<string, unknown>) => ({ _id: p._id, code: p.code, name: p.name, projectType: p.projectType })));
      if (docRes.ok) {
        const d = docRes.data;
        setPackageNo(d.packageNo ?? "");
        setForm({ subsystemName: d.subsystemName ?? "", status: d.status ?? "planned", description: d.description ?? "" });
        if (d.projectSnapshot?.projectId) {
          const proj = projRes.ok ? projRes.data.items.find((p: ProjectItem) => p._id === d.projectSnapshot.projectId) : null;
          if (proj) setSelectedProject({ _id: proj._id, code: proj.code, name: proj.name, projectType: proj.projectType });
          await loadProjectDetail(d.projectSnapshot.projectId, d.unitSnapshot?.unitId, d.systemSnapshot?.systemId);
        }
      }
      setLoadingDoc(false);
    };
    void init();
  }, [packageId]);

  const onProjectChange = async (id: string) => {
    const p = projects.find(p => p._id === id) ?? null;
    setSelectedProject(p);
    setSelectedUnit(null);
    setSelectedSystem(null);
    setUnits([]);
    setSystems([]);
    if (!id) return;
    await loadProjectDetail(id);
  };

  const onUnitChange = (id: string) => {
    setSelectedUnit(units.find(u => u._id === id) ?? null);
    setSelectedSystem(null);
  };

  const onSystemChange = (id: string) => {
    setSelectedSystem(systems.find(s => s._id === id) ?? null);
  };

  const filteredSystems = selectedUnit
    ? systems.filter(s => s.unitSnapshot?.unitId === selectedUnit._id)
    : systems;

  const update = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.subsystemName.trim()) {
      pushToast({ title: "필수 입력", description: "서브시스템을 입력해 주세요.", tone: "warning" });
      return;
    }
    const payload = {
      subsystemName: form.subsystemName.trim(),
      status: form.status,
      description: form.description.trim() || undefined,
      projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name, projectType: selectedProject.projectType } : null,
      unitSnapshot: selectedUnit ? { unitId: selectedUnit._id, unitNo: selectedUnit.unitNo } : null,
      systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name, discipline: selectedSystem.discipline } : null,
    };
    setSaving(true);
    try {
      const res = await fetch(`/api/commissioning-packages/${packageId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "패키지가 수정되었습니다.", tone: "success" });
        router.push(`/commissioning/packages/${packageId}`);
      } else {
        pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loadingDoc) return <StatePanel variant="loading" title="패키지 로딩 중" description="패키지 정보를 불러오고 있습니다." />;

  return (
    <>
      <PageHeader eyebrow="Commissioning" title="패키지 수정" description={packageNo}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/commissioning/packages/${packageId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="패키지번호" type="readonly" value={packageNo} />
            <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
            <FormField label="서브시스템" required value={form.subsystemName} onChange={update("subsystemName")} placeholder="서브시스템 명칭" />
            <FormField label="설명" value={form.description} onChange={update("description")} placeholder="패키지 설명 (선택)" />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">프로젝트 연결</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={onProjectChange}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <FormField label="유닛" type="select" value={selectedUnit?._id ?? ""}
              onChange={onUnitChange}
              options={[{ label: selectedProject ? "선택 안 함" : "프로젝트 먼저 선택", value: "" }, ...units.map(u => ({ label: u.unitNo, value: u._id }))]} />
            <FormField label="계통 (System)" type="select" value={selectedSystem?._id ?? ""}
              onChange={onSystemChange}
              options={[{ label: selectedProject ? "선택 안 함" : "프로젝트 먼저 선택", value: "" }, ...filteredSystems.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))]} />
            <FormField label="계통 분야" type="readonly" value={selectedSystem?.discipline ?? "-"} />
          </div>
        </Panel>
      </div>
    </>
  );
}
