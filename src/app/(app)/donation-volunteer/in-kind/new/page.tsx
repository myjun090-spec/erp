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
  const [form, setForm] = useState({ donorId: "", itemName: "", quantity: "", estimatedValue: "", distributedTo: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/in-kind-donations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/donation-volunteer/in-kind");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title="등록" actions={<><Link href="/donation-volunteer/in-kind" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="후원자ID"  value={form.donorId} onChange={v => setForm(p => ({...p, donorId: v}))} />
          <FormField label="물품명"  value={form.itemName} onChange={v => setForm(p => ({...p, itemName: v}))} />
          <FormField label="수량"  value={form.quantity} onChange={v => setForm(p => ({...p, quantity: v}))} />
          <FormField label="추정가액"  value={form.estimatedValue} onChange={v => setForm(p => ({...p, estimatedValue: v}))} />
          <FormField label="배분처"  value={form.distributedTo} onChange={v => setForm(p => ({...p, distributedTo: v}))} />
        </div>
      </Panel>
    </>
  );
}
