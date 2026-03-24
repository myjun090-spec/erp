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
  const [form, setForm] = useState({ name: "", category: "", targetGroup: "", objectives: "", totalSessions: "", maxParticipants: "", budget: "", fundingSource: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/programs");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="프로그램" title="등록" actions={<><Link href="/programs" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="프로그램명"  value={form.name} onChange={v => setForm(p => ({...p, name: v}))} />
          <FormField label="분류"  value={form.category} onChange={v => setForm(p => ({...p, category: v}))} />
          <FormField label="대상"  value={form.targetGroup} onChange={v => setForm(p => ({...p, targetGroup: v}))} />
          <FormField label="목표" type="textarea" rows={4} value={form.objectives} onChange={v => setForm(p => ({...p, objectives: v}))} />
          <FormField label="총세션수"  value={form.totalSessions} onChange={v => setForm(p => ({...p, totalSessions: v}))} />
          <FormField label="최대인원"  value={form.maxParticipants} onChange={v => setForm(p => ({...p, maxParticipants: v}))} />
          <FormField label="예산"  value={form.budget} onChange={v => setForm(p => ({...p, budget: v}))} />
          <FormField label="재원"  value={form.fundingSource} onChange={v => setForm(p => ({...p, fundingSource: v}))} />
        </div>
      </Panel>
    </>
  );
}
