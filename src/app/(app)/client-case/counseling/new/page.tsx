"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

const sessionTypes = [
  { label: "대면", value: "대면" },
  { label: "전화", value: "전화" },
  { label: "방문", value: "방문" },
  { label: "온라인", value: "온라인" },
];

export default function CounselingNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clientId: "", sessionType: "대면", duration: "60", content: "" });
  const update = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.content.trim()) { pushToast({ title: "필수 입력", description: "상담 내용을 입력하세요.", tone: "warning" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/counseling-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, duration: Number(form.duration) }) });
      const json = await res.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "오류가 발생했습니다.", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", tone: "success" });
      router.push("/client-case/counseling");
    } catch { pushToast({ title: "등록 실패", description: "네트워크 오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="이용자/사례" title="상담기록 등록" actions={<><Link href="/client-case/counseling" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold">취소</Link><button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="이용자 ID" value={form.clientId} onChange={update("clientId")} placeholder="이용자 ID" />
          <FormField label="상담유형" type="select" value={form.sessionType} onChange={update("sessionType")} options={sessionTypes} />
          <FormField label="상담시간(분)" value={form.duration} onChange={update("duration")} inputMode="numeric" />
          <div className="md:col-span-2"><FormField label="상담내용" type="textarea" value={form.content} onChange={update("content")} rows={6} /></div>
        </div>
      </Panel>
    </>
  );
}
