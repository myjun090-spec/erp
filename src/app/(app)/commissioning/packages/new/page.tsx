"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { generatePackageNo } from "@/lib/document-numbers";

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

export default function CommPackageNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const packageNo = useMemo(() => generatePackageNo(), []);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subsystemName: "", status: "planned", description: "" });

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(j => { if (j.ok) setProjects(j.data.items.map((p: ProjectItem & Record<string, unknown>) => ({ _id: p._id, code: p.code, name: p.name, projectType: p.projectType }))); })
      .catch(() => pushToast({ title: "오류", description: "프로젝트 목록을 불러오지 못했습니다.", tone: "warning" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onProjectChange = async (id: string) => {
    const p = projects.find(p => p._id === id) ?? null;
    setSelectedProject(p);
    setSelectedUnit(null);
    setSelectedSystem(null);
    setUnits([]);
    setSystems([]);
    if (!id) return;
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = await res.json();
      if (json.ok) {
        setUnits((json.data._units ?? []).map((u: UnitItem & Record<string, unknown>) => ({ _id: u._id, unitNo: u.unitNo })));
        setSystems((json.data._systems ?? []).map((s: SystemItem & Record<string, unknown>) => ({ _id: s._id, code: s.code as string, name: s.name as string, discipline: s.discipline as string, unitSnapshot: s.unitSnapshot as SystemItem["unitSnapshot"] })));
      }
    } catch { pushToast({ title: "오류", description: "프로젝트 상세를 불러오지 못했습니다.", tone: "warning" }); }
  };

  const onUnitChange = (id: string) => {
    const u = units.find(u => u._id === id) ?? null;
    setSelectedUnit(u);
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
      packageNo,
      projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name, projectType: selectedProject.projectType } : null,
      unitSnapshot: selectedUnit ? { unitId: selectedUnit._id, unitNo: selectedUnit.unitNo } : null,
      systemSnapshot: selectedSystem ? { systemId: selectedSystem._id, code: selectedSystem.code, name: selectedSystem.name, discipline: selectedSystem.discipline } : null,
      subsystemName: form.subsystemName.trim(),
      status: form.status,
      description: form.description.trim() || undefined,
      punchItems: [],
      testItems: [],
      turnover: { status: "planned", dossierNo: "" },
    };
    setSaving(true);
    try {
      const res = await fetch("/api/commissioning-packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "패키지가 등록되었습니다.", tone: "success" });
        router.push("/commissioning/packages");
      } else {
        pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Commissioning" title="패키지 등록" description="새로운 시운전 패키지를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/commissioning/packages" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
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
