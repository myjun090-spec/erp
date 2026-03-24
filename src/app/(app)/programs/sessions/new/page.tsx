"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

export default function Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ programId: "", sessionNumber: "", title: "", sessionDate: "", location: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/program-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/programs/sessions");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="프로그램" title="등록" actions={<><Link href="/programs/sessions" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="프로그램ID"  value={form.programId} onChange={v => setForm(p => ({...p, programId: v}))} />
          <FormField label="세션번호"  value={form.sessionNumber} onChange={v => setForm(p => ({...p, sessionNumber: v}))} />
          <FormField label="제목"  value={form.title} onChange={v => setForm(p => ({...p, title: v}))} />
          <FormField label="일자"  value={form.sessionDate} onChange={v => setForm(p => ({...p, sessionDate: v}))} />
          <FormField label="장소"  value={form.location} onChange={v => setForm(p => ({...p, location: v}))} />
        </div>
      </Panel>
    </>
  );
}
