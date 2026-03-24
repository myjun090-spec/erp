"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

export default function ClosureNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clientId: "", closureReason: "", followUpPlan: "" });
  const update = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.closureReason.trim()) { pushToast({ title: "필수 입력", description: "종결사유를 입력하세요.", tone: "warning" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/case-closures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message, tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" }); router.push("/client-case/closures");
    } catch { pushToast({ title: "오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title="사례종결 등록" actions={<><Link href="/client-case/closures" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="이용자 ID" value={form.clientId} onChange={update("clientId")} />
          <FormField label="종결사유" value={form.closureReason} onChange={update("closureReason")} />
          <div className="md:col-span-2"><FormField label="사후관리계획" type="textarea" value={form.followUpPlan} onChange={update("followUpPlan")} rows={4} /></div>
        </div>
      </Panel>
    </>
  );
}
