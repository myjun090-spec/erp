"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { generateRegulatoryActionNo } from "@/lib/document-numbers";
import { ACTION_TYPE_OPTIONS, formatPhone, isValidEmail, DocRefList, useProjects } from "../_shared";
import type { DocRef, ProjectOption } from "../_shared";

export default function RegulatoryNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const actionNo = useMemo(() => generateRegulatoryActionNo(), []);
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    regulator: "", actionType: "", subject: "", dueDate: "",
    ownerName: "", ownerOrgUnit: "", ownerPhone: "010", ownerEmail: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [docRefs, setDocRefs] = useState<DocRef[]>([]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [key]: key === "ownerPhone" ? formatPhone(value) : value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.regulator.trim()) next.regulator = "규제기관을 입력해 주세요.";
    if (!form.actionType) next.actionType = "유형을 선택해 주세요.";
    if (!form.subject.trim()) next.subject = "주제를 입력해 주세요.";
    if (form.ownerPhone && form.ownerPhone !== "010" && !/^\d{3}-\d{3,4}-\d{4}$/.test(form.ownerPhone))
      next.ownerPhone = "010-1234-1234 형식으로 입력해 주세요.";
    if (form.ownerEmail && !isValidEmail(form.ownerEmail))
      next.ownerEmail = "올바른 이메일 형식이 아닙니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload = {
      actionNo,
      regulator: form.regulator.trim(),
      actionType: form.actionType,
      subject: form.subject.trim(),
      dueDate: form.dueDate || undefined,
      ownerName: form.ownerName.trim() || undefined,
      ownerOrgUnit: form.ownerOrgUnit.trim() || undefined,
      ownerPhone: form.ownerPhone === "010" ? undefined : form.ownerPhone,
      ownerEmail: form.ownerEmail.trim() || undefined,
      relatedDocumentRefs: docRefs.filter(d => d.refNo.trim() || d.title.trim()),
      projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name, projectType: selectedProject.projectType } : null,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/regulatory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) { pushToast({ title: "등록 완료", description: "규제대응이 등록되었습니다.", tone: "success" }); router.push("/commissioning/regulatory"); }
      else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Commissioning" title="규제대응 등록" description="새로운 규제대응을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/commissioning/regulatory" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">대응 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="대응번호" type="readonly" value={actionNo} />
            <FormField label="유형" type="select" required value={form.actionType} onChange={update("actionType")} options={[{ label: "선택", value: "" }, ...ACTION_TYPE_OPTIONS]} error={errors.actionType} />
            <FormField label="규제기관" required value={form.regulator} onChange={update("regulator")} placeholder="원안위, NSSC 등" error={errors.regulator} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => setSelectedProject(projects.find(p => p._id === id) ?? null)}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <DatePicker label="기한" value={form.dueDate} onChange={update("dueDate")} />
            <div className="md:col-span-2">
              <FormField label="주제" required value={form.subject} onChange={update("subject")} placeholder="대응 주제" error={errors.subject} />
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">담당자</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="담당자명" value={form.ownerName} onChange={update("ownerName")} placeholder="담당자 이름 (미입력 시 로그인 사용자)" />
            <FormField label="소속" value={form.ownerOrgUnit} onChange={update("ownerOrgUnit")} placeholder="부서/팀명" />
            <FormField label="연락처" value={form.ownerPhone} onChange={update("ownerPhone")} placeholder="010-1234-1234" error={errors.ownerPhone} />
            <FormField label="이메일" value={form.ownerEmail} onChange={update("ownerEmail")} placeholder="example@company.com" error={errors.ownerEmail} />
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-2">
          <DocRefList rows={docRefs} onChange={setDocRefs} />
        </Panel>
      </div>
    </>
  );
}
