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
  const [form, setForm] = useState({ volunteerId: "", activityId: "", hours: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/volunteer-hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/donation-volunteer/hours");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title="등록" actions={<><Link href="/donation-volunteer/hours" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="봉사자ID"  value={form.volunteerId} onChange={v => setForm(p => ({...p, volunteerId: v}))} />
          <FormField label="활동ID"  value={form.activityId} onChange={v => setForm(p => ({...p, activityId: v}))} />
          <FormField label="시간"  value={form.hours} onChange={v => setForm(p => ({...p, hours: v}))} />
        </div>
      </Panel>
    </>
  );
}
