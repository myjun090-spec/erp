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
import { ACTION_TYPE_OPTIONS, formatPhone, isValidEmail, DocRefList, useProjects } from "../../_shared";
import type { DocRef, ProjectOption } from "../../_shared";

const STATUS_OPTIONS = [
  { label: "대응중", value: "open" },
  { label: "종결", value: "closed" },
];

export default function RegulatoryEditPage() {
  const { actionId } = useParams<{ actionId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionNo, setActionNo] = useState("");
  const [form, setForm] = useState({
    regulator: "", actionType: "", subject: "", dueDate: "", status: "open", responseDate: "",
    ownerName: "", ownerOrgUnit: "", ownerPhone: "010", ownerEmail: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [docRefs, setDocRefs] = useState<DocRef[]>([]);

  useEffect(() => {
    fetch(`/api/regulatory/${actionId}`).then(r => r.json()).then(json => {
      if (json.ok) {
        const d = json.data;
        setActionNo(d.actionNo ?? "");
        setForm({
          regulator: d.regulator ?? "",
          actionType: d.actionType ?? "",
          subject: d.subject ?? "",
          dueDate: d.dueDate ?? "",
          status: d.status ?? "open",
          responseDate: d.responseDate ?? "",
          ownerName: d.ownerUserSnapshot?.displayName ?? "",
          ownerOrgUnit: d.ownerUserSnapshot?.orgUnitName ?? "",
          ownerPhone: d.ownerUserSnapshot?.phone || "010",
          ownerEmail: d.ownerUserSnapshot?.email ?? "",
        });
        setDocRefs(d.relatedDocumentRefs ?? []);
        if (d.projectSnapshot?.projectId) {
          setSelectedProject({ _id: d.projectSnapshot.projectId, code: d.projectSnapshot.code, name: d.projectSnapshot.name, projectType: d.projectSnapshot.projectType ?? "" });
        }
      }
      setLoadingDoc(false);
    }).catch(() => setLoadingDoc(false));
  }, [actionId]);

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
      regulator: form.regulator.trim(),
      actionType: form.actionType,
      subject: form.subject.trim(),
      dueDate: form.dueDate || undefined,
      status: form.status,
      responseDate: form.responseDate || undefined,
      ownerName: form.ownerName.trim() || undefined,
      ownerOrgUnit: form.ownerOrgUnit.trim() || undefined,
      ownerPhone: form.ownerPhone === "010" ? "" : form.ownerPhone,
      ownerEmail: form.ownerEmail.trim() || undefined,
      relatedDocumentRefs: docRefs.filter(d => d.refNo.trim() || d.title.trim()),
      projectSnapshot: selectedProject ? { projectId: selectedProject._id, code: selectedProject.code, name: selectedProject.name, projectType: selectedProject.projectType } : null,
    };
    setSaving(true);
    try {
      const res = await fetch(`/api/regulatory/${actionId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "규제대응이 수정되었습니다.", tone: "success" });
        router.push(`/commissioning/regulatory/${actionId}`);
      } else pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  if (loadingDoc) return <StatePanel variant="loading" title="로딩 중" description="규제대응 정보를 불러오고 있습니다." />;

  return (
    <>
      <PageHeader eyebrow="Commissioning" title="규제대응 수정" description={actionNo}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/commissioning/regulatory/${actionId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">대응 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="대응번호" type="readonly" value={actionNo} />
            <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
            <FormField label="유형" type="select" required value={form.actionType} onChange={update("actionType")} options={[{ label: "선택", value: "" }, ...ACTION_TYPE_OPTIONS]} error={errors.actionType} />
            <FormField label="규제기관" required value={form.regulator} onChange={update("regulator")} placeholder="원안위, NSSC 등" error={errors.regulator} />
            <FormField label="프로젝트" type="select" value={selectedProject?._id ?? ""}
              onChange={id => setSelectedProject(projects.find(p => p._id === id) ?? null)}
              options={[{ label: "선택 안 함", value: "" }, ...projects.map(p => ({ label: `${p.code} · ${p.name}`, value: p._id }))]} />
            <DatePicker label="기한" value={form.dueDate} onChange={update("dueDate")} />
            <DatePicker label="응답일" value={form.responseDate} onChange={update("responseDate")} />
            <div className="md:col-span-2">
              <FormField label="주제" required value={form.subject} onChange={update("subject")} placeholder="대응 주제" error={errors.subject} />
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">담당자</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="담당자명" value={form.ownerName} onChange={update("ownerName")} placeholder="담당자 이름" />
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
