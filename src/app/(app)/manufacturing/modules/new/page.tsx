"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { generateModuleNo } from "@/lib/document-numbers";

type ProjectOption = { _id: string; code: string; name: string; projectType: string };
type SystemOption = { _id: string; code: string; name: string; discipline: string };
type VendorOption = { _id: string; code: string; name: string };

const MODULE_TYPE_OPTIONS = [
  { label: "원자로", value: "reactor" },
  { label: "터빈", value: "turbine" },
  { label: "보조", value: "auxiliary" },
  { label: "BOP", value: "bop" },
  { label: "원자로 스키드", value: "reactor-skid" },
  { label: "제어 랙", value: "control-rack" },
  { label: "해상 스키드", value: "offshore-skid" },
  { label: "지지 구조물", value: "support-frame" },
  { label: "파일럿 루프", value: "pilot-loop" },
  { label: "터빈 발전기", value: "turbine-generator" },
];

const STATUS_OPTIONS = [
  { label: "계획", value: "planned" },
  { label: "제작중", value: "fabricating" },
  { label: "검사중", value: "testing" },
  { label: "재작업", value: "rework" },
  { label: "출하", value: "shipped" },
  { label: "설치완료", value: "installed" },
];

export default function ModuleNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [form, setForm] = useState({
    moduleNo: generateModuleNo(),
    moduleType: "",
    serialNo: "",
    projectId: "",
    systemId: "",
    manufacturerId: "",
    status: "planned",
  });

  const update = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const [projectsRes, vendorsRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/vendors"),
        ]);
        const [projectsJson, vendorsJson] = await Promise.all([
          projectsRes.json(),
          vendorsRes.json(),
        ]);

        if (!projectsJson.ok) { setError(projectsJson.message || "프로젝트 목록을 불러오지 못했습니다."); return; }
        if (!vendorsJson.ok) { setError(vendorsJson.message || "제작사 목록을 불러오지 못했습니다."); return; }

        setProjects(projectsJson.data.items.map((p: ProjectOption) => ({ _id: p._id, code: p.code, name: p.name, projectType: p.projectType })));
        setVendors(vendorsJson.data.items.map((v: VendorOption) => ({ _id: v._id, code: v.code, name: v.name })));
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (!form.projectId) { setSystems([]); update("systemId")(""); return; }
    async function loadSystems() {
      try {
        const res = await fetch(`/api/projects/${form.projectId}/systems`);
        const json = await res.json();
        if (json.ok) {
          setSystems(json.data.items.map((s: SystemOption) => ({ _id: s._id, code: s.code, name: s.name, discipline: s.discipline })));
        }
      } catch { /* ignore */ }
    }
    void loadSystems();
    update("systemId")("");
  }, [form.projectId]);

  const handleSubmit = async () => {
    if (!form.moduleType) {
      pushToast({ title: "필수 입력", description: "모듈유형은 필수입니다.", tone: "warning" });
      return;
    }

    const selectedProject = projects.find((p) => p._id === form.projectId);
    const selectedSystem = systems.find((s) => s._id === form.systemId);
    const selectedVendor = vendors.find((v) => v._id === form.manufacturerId);

    const payload: Record<string, unknown> = {
      moduleNo: form.moduleNo || generateModuleNo(),
      moduleType: form.moduleType,
      serialNo: form.serialNo,
      status: form.status,
    };

    if (selectedProject) {
      payload.projectId = selectedProject._id;
      payload.projectSnapshot = {
        projectId: selectedProject._id,
        code: selectedProject.code,
        name: selectedProject.name,
        projectType: selectedProject.projectType,
      };
    }

    if (selectedSystem) {
      payload.systemId = selectedSystem._id;
      payload.systemSnapshot = {
        systemId: selectedSystem._id,
        code: selectedSystem.code,
        name: selectedSystem.name,
        discipline: selectedSystem.discipline,
      };
    }

    if (selectedVendor) {
      payload.manufacturerId = selectedVendor._id;
      payload.manufacturerSnapshot = {
        manufacturerId: selectedVendor._id,
        code: selectedVendor.code,
        name: selectedVendor.name,
      };
    }

    setSaving(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "모듈이 등록되었습니다.", tone: "success" });
        router.push("/manufacturing/modules");
      } else {
        pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="모듈 등록 준비 중" description="프로젝트 및 제작사 목록을 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="모듈 등록 준비 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Manufacturing"
        title="모듈 등록"
        description="새로운 모듈을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href="/manufacturing/modules" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
            <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">모듈 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="모듈번호" type="readonly" value={form.moduleNo} />
            <FormField label="모듈유형" required type="select" value={form.moduleType} onChange={update("moduleType")} options={MODULE_TYPE_OPTIONS} />
            <FormField label="S/N" value={form.serialNo} onChange={update("serialNo")} placeholder="일련번호" />
            <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">연결 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="프로젝트"
              type="select"
              value={form.projectId}
              onChange={update("projectId")}
              options={projects.map((p) => ({ label: `${p.name} (${p.code})`, value: p._id }))}
            />
            <FormField
              label="계통"
              type="select"
              value={form.systemId}
              onChange={update("systemId")}
              options={systems.map((s) => ({ label: `${s.name} (${s.code})`, value: s._id }))}
            />
            <FormField
              label="제작사"
              type="select"
              value={form.manufacturerId}
              onChange={update("manufacturerId")}
              options={vendors.map((v) => ({ label: `${v.name} (${v.code})`, value: v._id }))}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
