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
  const [form, setForm] = useState({ donorId: "", donationType: "", amount: "", paymentMethod: "" });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/donations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/donation-volunteer/donations");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="후원/봉사" title="등록" actions={<><Link href="/donation-volunteer/donations" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="후원자ID"  value={form.donorId} onChange={v => setForm(p => ({...p, donorId: v}))} />
          <FormField label="후원유형"  value={form.donationType} onChange={v => setForm(p => ({...p, donationType: v}))} />
          <FormField label="금액"  value={form.amount} onChange={v => setForm(p => ({...p, amount: v}))} />
          <FormField label="결제방법"  value={form.paymentMethod} onChange={v => setForm(p => ({...p, paymentMethod: v}))} />
        </div>
      </Panel>
    </>
  );
}
