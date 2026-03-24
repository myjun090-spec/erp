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
  const [form, setForm] = useState({ name: "", phone: "", skills: "", availableDays: "", orientation1365Id: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/volunteers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/donation-volunteer/volunteers");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title="등록" actions={<><Link href="/donation-volunteer/volunteers" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="이름"  value={form.name} onChange={v => setForm(p => ({...p, name: v}))} />
          <FormField label="연락처"  value={form.phone} onChange={v => setForm(p => ({...p, phone: v}))} />
          <FormField label="기술/능력"  value={form.skills} onChange={v => setForm(p => ({...p, skills: v}))} />
          <FormField label="가능요일"  value={form.availableDays} onChange={v => setForm(p => ({...p, availableDays: v}))} />
          <FormField label="1365 ID"  value={form.orientation1365Id} onChange={v => setForm(p => ({...p, orientation1365Id: v}))} />
        </div>
      </Panel>
    </>
  );
}
