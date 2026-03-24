"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

export default function ParticipantNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    programName: "",
    clientName: "",
    enrollmentDate: "",
    facilityName: "",
  });

  const update = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.clientName.trim() || !form.programName.trim()) {
      pushToast({ title: "필수 입력", description: "프로그램명과 참여자명을 확인해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/program-participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSnapshot: { name: form.programName.trim() },
          clientSnapshot: { name: form.clientName.trim() },
          enrollmentDate: form.enrollmentDate,
          attendanceRecords: [],
          attendanceRate: 0,
          facilitySnapshot: form.facilityName.trim() ? { name: form.facilityName.trim() } : null,
          status: "enrolled",
        }),
      });
      const json = await response.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "참여자를 등록하지 못했습니다.", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", description: "참여자가 등록되었습니다.", tone: "success" });
      router.push("/programs/participants");
    } catch { pushToast({ title: "등록 실패", description: "네트워크 오류가 발생했습니다.", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Programs" title="참여자 등록" description="프로그램 참여자를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href="/programs/participants" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
            <button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
          </>
        }
      />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="프로그램명" required value={form.programName} onChange={update("programName")} placeholder="프로그램 이름" />
          <FormField label="참여자명" required value={form.clientName} onChange={update("clientName")} placeholder="이용자 이름" />
          <FormField label="등록일" type="date" value={form.enrollmentDate} onChange={update("enrollmentDate")} />
          <FormField label="시설명" value={form.facilityName} onChange={update("facilityName")} placeholder="시설 이름" />
        </div>
      </Panel>
    </>
  );
}
