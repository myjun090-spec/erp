"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { generateIncidentNo } from "@/lib/document-numbers";
import { INCIDENT_TYPE_OPTIONS, SEVERITY_OPTIONS, isValidEmail, CorrectiveActionList, useProjects, useCurrentUser, useSites } from "../_shared";
import type { CorrectiveAction, ProjectOption, SiteOption } from "../_shared";

export default function HseNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const incidentNo = useMemo(() => generateIncidentNo(), []);
  const projects = useProjects();
  const sites = useSites();
  const currentUser = useCurrentUser();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    incidentType: "", severity: "low", title: "", occurredAt: "", description: "",
    ownerName: "", ownerOrgUnit: "", ownerPhone: "010", ownerEmail: "",
  });

  useEffect(() => {
    if (currentUser) {
      setForm(prev => ({
        ...prev,
        ownerName: prev.ownerName || currentUser.displayName,
        ownerOrgUnit: prev.ownerOrgUnit || currentUser.orgUnitName,
        ownerEmail: prev.ownerEmail || currentUser.email,
      }));
    }
  }, [currentUser]);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.incidentType) next.incidentType = "유형을 선택해 주세요.";
    if (!form.title.trim()) next.title = "제목을 입력해 주세요.";
    if (!form.occurredAt) next.occurredAt = "발생일을 입력해 주세요.";
    if (form.ownerEmail && !isValidEmail(form.ownerEmail))
      next.ownerEmail = "올바른 이메일 형식이 아닙니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = {
      incidentNo,
      incidentType: form.incidentType,
      severity: form.severity,
      title: form.title.trim(),
      occurredAt: form.occurredAt || undefined,
      description: form.description.trim() || undefined,
      ownerName: form.ownerName.trim() || undefined,
      ownerOrgUnit: form.ownerOrgUnit.trim() || undefined,
      ownerPhone: form.ownerPhone === "010" ? undefined : form.ownerPhone,
      ownerEmail: form.ownerEmail.trim() || undefined,
      correctiveActions: correctiveActions.filter(a => a.code.trim() || a.description.trim()),
      projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name, projectType: selectedProject.projectType } : null,
      siteSnapshot: selectedSite ? { siteId: selectedSite._id, code: selectedSite.code, name: selectedSite.name } : null,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/hse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "HSE 사고가 등록되었습니다.", tone: "success" });
        router.push("/safety/hse");
      } else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Safety" title="HSE 사고 등록" description="새로운 안전사고를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/safety/hse" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">사고 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="사고번호" type="readonly" value={incidentNo} />
            <FormField label="유형" type="select" required value={form.incidentType} onChange={update("incidentType")} options={[{ label: "선택", value: "" }, ...INCIDENT_TYPE_OPTIONS]} error={errors.incidentType} />
            <FormField label="심각도" type="select" value={form.severity} onChange={update("severity")} options={SEVERITY_OPTIONS} />
            <DatePicker label="발생일" required value={form.occurredAt} onChange={update("occurredAt")} error={errors.occurredAt} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => { setSelectedProject(projects.find(p => p._id === id) ?? null); setSelectedSite(null); }}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <FormField label="발생 현장" type="select" value={selectedSite?._id ?? ""}
              onChange={id => setSelectedSite(sites.find(s => s._id === id) ?? null)}
              options={(() => {
                const filtered = sites.filter(s => s.projectSnapshot?.projectId === selectedProject?._id);
                const placeholder = !selectedProject ? "프로젝트를 먼저 선택하세요" : filtered.length === 0 ? "등록된 현장이 없습니다" : "선택 안 함";
                return [{ label: placeholder, value: "" }, ...filtered.map(s => ({ label: `${s.code} · ${s.name}`, value: s._id }))];
              })()} />
            <div className="md:col-span-2">
              <FormField label="제목" required value={form.title} onChange={update("title")} placeholder="사고 제목" error={errors.title} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--text-muted)]">상세 내용</label>
              <textarea
                value={form.description}
                onChange={e => update("description")(e.target.value)}
                placeholder="사고 경위, 상세 내용을 입력해 주세요."
                rows={3}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white resize-none"
              />
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">담당자</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="담당자명" type="readonly" value={form.ownerName || "-"} />
            <FormField label="소속" type="readonly" value={form.ownerOrgUnit || "-"} />
            <FormField label="이메일" type="readonly" value={form.ownerEmail || "-"} />
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-2">
          <CorrectiveActionList rows={correctiveActions} onChange={setCorrectiveActions} />
        </Panel>
      </div>
    </>
  );
}
