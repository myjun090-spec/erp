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
  const [form, setForm] = useState({ title: "", date: "", startTime: "", endTime: "", location: "", category: "", memo: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/schedule");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="일정관리" title="등록" actions={<><Link href="/schedule" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="제목"  value={form.title} onChange={v => setForm(p => ({...p, title: v}))} />
          <FormField label="일자"  value={form.date} onChange={v => setForm(p => ({...p, date: v}))} />
          <FormField label="시작시간"  value={form.startTime} onChange={v => setForm(p => ({...p, startTime: v}))} />
          <FormField label="종료시간"  value={form.endTime} onChange={v => setForm(p => ({...p, endTime: v}))} />
          <FormField label="장소"  value={form.location} onChange={v => setForm(p => ({...p, location: v}))} />
          <FormField label="분류"  value={form.category} onChange={v => setForm(p => ({...p, category: v}))} />
          <FormField label="메모" type="textarea" rows={4} value={form.memo} onChange={v => setForm(p => ({...p, memo: v}))} />
        </div>
      </Panel>
    </>
  );
}
