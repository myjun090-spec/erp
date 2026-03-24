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
  const [form, setForm] = useState({ weekStartDate: "", weekEndDate: "", weeklyGoals: "", achievements: "", nextWeekPlan: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/work-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/work-log");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="업무일지" title="등록" actions={<><Link href="/work-log" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="시작일"  value={form.weekStartDate} onChange={v => setForm(p => ({...p, weekStartDate: v}))} />
          <FormField label="종료일"  value={form.weekEndDate} onChange={v => setForm(p => ({...p, weekEndDate: v}))} />
          <FormField label="주간목표" type="textarea" rows={4} value={form.weeklyGoals} onChange={v => setForm(p => ({...p, weeklyGoals: v}))} />
          <FormField label="성과" type="textarea" rows={4} value={form.achievements} onChange={v => setForm(p => ({...p, achievements: v}))} />
          <FormField label="다음주계획" type="textarea" rows={4} value={form.nextWeekPlan} onChange={v => setForm(p => ({...p, nextWeekPlan: v}))} />
        </div>
      </Panel>
    </>
  );
}
