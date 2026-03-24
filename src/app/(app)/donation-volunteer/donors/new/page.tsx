"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

const donorTypeOptions = [
  { label: "개인", value: "individual" },
  { label: "기업", value: "corporate" },
  { label: "단체", value: "organization" },
];

const donorCategoryOptions = [
  { label: "정기", value: "정기" },
  { label: "비정기", value: "비정기" },
  { label: "일시", value: "일시" },
];

const preferredUsageOptions = [
  { label: "지정", value: "지정" },
  { label: "비지정", value: "비지정" },
];

export default function DonorNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    donorType: "individual",
    name: "",
    representativeName: "",
    phone: "",
    email: "",
    address: "",
    taxIdNo: "",
    donorCategory: "정기",
    preferredUsage: "비지정",
    facilityName: "",
  });

  const update = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      pushToast({ title: "필수 입력", description: "후원자명을 확인해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/donors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donorType: form.donorType,
          name: form.name.trim(),
          representativeName: form.representativeName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          taxIdNo: form.taxIdNo.trim(),
          donorCategory: form.donorCategory,
          preferredUsage: form.preferredUsage,
          facilitySnapshot: form.facilityName.trim() ? { name: form.facilityName.trim() } : null,
          status: "active",
        }),
      });
      const json = await response.json();
      if (!json.ok) { pushToast({ title: "등록 실패", description: json.message || "후원자를 등록하지 못했습니다.", tone: "warning" }); return; }
      pushToast({ title: "등록 완료", description: "후원자가 등록되었습니다.", tone: "success" });
      router.push("/donation-volunteer/donors");
    } catch { pushToast({ title: "등록 실패", description: "네트워크 오류가 발생했습니다.", tone: "warning" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Donation & Volunteer" title="후원자 등록" description="새 후원자를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href="/donation-volunteer/donors" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
            <button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
          </>
        }
      />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="유형" type="select" value={form.donorType} onChange={update("donorType")} options={donorTypeOptions} />
          <FormField label="후원자명" required value={form.name} onChange={update("name")} placeholder="이름 또는 단체명" />
          <FormField label="대표자명" value={form.representativeName} onChange={update("representativeName")} placeholder="대표자명" />
          <FormField label="연락처" value={form.phone} onChange={update("phone")} placeholder="010-0000-0000" />
          <FormField label="이메일" value={form.email} onChange={update("email")} placeholder="email@example.com" />
          <FormField label="사업자번호" value={form.taxIdNo} onChange={update("taxIdNo")} placeholder="000-00-00000" />
          <FormField label="후원구분" type="select" value={form.donorCategory} onChange={update("donorCategory")} options={donorCategoryOptions} />
          <FormField label="용도지정" type="select" value={form.preferredUsage} onChange={update("preferredUsage")} options={preferredUsageOptions} />
          <FormField label="시설명" value={form.facilityName} onChange={update("facilityName")} placeholder="시설 이름" />
          <div className="md:col-span-2 lg:col-span-3">
            <FormField label="주소" value={form.address} onChange={update("address")} placeholder="주소" />
          </div>
        </div>
      </Panel>
    </>
  );
}
