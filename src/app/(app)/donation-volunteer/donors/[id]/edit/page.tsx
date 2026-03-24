"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
const statusOptions = [
  { label: "활성", value: "active" },
  { label: "비활성", value: "inactive" },
];

type DonorDoc = { _id: string; donorNo: string; donorType: string; name: string; representativeName: string; phone: string; email: string; address: string; taxIdNo: string; donorCategory: string; preferredUsage: string; status: string };

export default function DonorEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<DonorDoc | null>(null);
  const [form, setForm] = useState({ donorType: "individual", name: "", representativeName: "", phone: "", email: "", address: "", taxIdNo: "", donorCategory: "정기", preferredUsage: "비지정", status: "active" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/donors/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) { pushToast({ title: "조회 실패", description: json.message, tone: "warning" }); router.push("/donation-volunteer/donors"); return; }
        const d = json.data as DonorDoc;
        setDoc(d);
        setForm({ donorType: d.donorType || "individual", name: d.name || "", representativeName: d.representativeName || "", phone: d.phone || "", email: d.email || "", address: d.address || "", taxIdNo: d.taxIdNo || "", donorCategory: d.donorCategory || "정기", preferredUsage: d.preferredUsage || "비지정", status: d.status || "active" });
      } catch { if (!cancelled) { pushToast({ title: "조회 실패", description: "네트워크 오류", tone: "warning" }); router.push("/donation-volunteer/donors"); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, pushToast, router]);

  const update = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!doc) return;
    if (!form.name.trim()) { pushToast({ title: "필수 입력", description: "후원자명을 확인해 주세요.", tone: "warning" }); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/donors/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donorType: form.donorType, name: form.name.trim(), representativeName: form.representativeName.trim(), phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), taxIdNo: form.taxIdNo.trim(), donorCategory: form.donorCategory, preferredUsage: form.preferredUsage, status: form.status }) });
      const json = await response.json();
      if (!json.ok) { pushToast({ title: "저장 실패", description: json.message, tone: "warning" }); return; }
      pushToast({ title: "저장 완료", description: "후원자가 업데이트되었습니다.", tone: "success" });
      router.push(`/donation-volunteer/donors/${doc._id}`);
    } catch { pushToast({ title: "저장 실패", description: "네트워크 오류", tone: "warning" }); }
    finally { setSaving(false); }
  };

  if (loading || !doc) return <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">로딩 중...</div>;

  return (
    <>
      <PageHeader eyebrow="Donation & Volunteer" title={`${doc.donorNo} 수정`} description="후원자 정보를 수정합니다."
        actions={
          <>
            <Link href={`/donation-volunteer/donors/${id}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
            <button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
          </>
        }
      />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="후원자번호" type="readonly" value={doc.donorNo} />
          <FormField label="유형" type="select" value={form.donorType} onChange={update("donorType")} options={donorTypeOptions} />
          <FormField label="후원자명" required value={form.name} onChange={update("name")} placeholder="이름 또는 단체명" />
          <FormField label="대표자명" value={form.representativeName} onChange={update("representativeName")} placeholder="대표자명" />
          <FormField label="연락처" value={form.phone} onChange={update("phone")} placeholder="010-0000-0000" />
          <FormField label="이메일" value={form.email} onChange={update("email")} placeholder="email@example.com" />
          <FormField label="사업자번호" value={form.taxIdNo} onChange={update("taxIdNo")} placeholder="000-00-00000" />
          <FormField label="후원구분" type="select" value={form.donorCategory} onChange={update("donorCategory")} options={donorCategoryOptions} />
          <FormField label="용도지정" type="select" value={form.preferredUsage} onChange={update("preferredUsage")} options={preferredUsageOptions} />
          <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={statusOptions} />
          <div className="md:col-span-2 lg:col-span-3">
            <FormField label="주소" value={form.address} onChange={update("address")} placeholder="주소" />
          </div>
        </div>
      </Panel>
    </>
  );
}
