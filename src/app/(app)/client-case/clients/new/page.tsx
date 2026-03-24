"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

const genderOptions = [
  { label: "남", value: "남" },
  { label: "여", value: "여" },
];

const registrationTypeOptions = [
  { label: "신규", value: "신규" },
  { label: "재등록", value: "재등록" },
  { label: "의뢰", value: "의뢰" },
];

const careLevelOptions = [
  { label: "1등급", value: "1등급" },
  { label: "2등급", value: "2등급" },
  { label: "3등급", value: "3등급" },
  { label: "4등급", value: "4등급" },
  { label: "5등급", value: "5등급" },
  { label: "인지지원등급", value: "인지지원등급" },
  { label: "해당없음", value: "해당없음" },
];

const incomeLevelOptions = [
  { label: "기초생활", value: "기초생활" },
  { label: "차상위", value: "차상위" },
  { label: "일반", value: "일반" },
];

export default function ClientNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birthDate: "",
    gender: "",
    phone: "",
    address: "",
    registrationType: "신규",
    careLevel: "해당없음",
    incomeLevel: "일반",
  });

  const update =
    (key: keyof typeof form) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      pushToast({
        title: "필수 입력",
        description: "이용자 이름을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          birthDate: form.birthDate,
          gender: form.gender,
          phone: form.phone.trim(),
          address: form.address.trim(),
          registrationType: form.registrationType,
          careLevel: form.careLevel,
          incomeLevel: form.incomeLevel,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "이용자를 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "이용자가 등록되었습니다.",
        tone: "success",
      });
      router.push("/client-case/clients");
    } catch {
      pushToast({
        title: "등록 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="이용자"
        title="이용자 등록"
        description="새로운 이용자를 등록합니다."
        actions={
          <>
            <Link
              href="/client-case/clients"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />

      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="이름"
            required
            value={form.name}
            onChange={update("name")}
            placeholder="이용자 이름"
          />
          <FormField
            label="생년월일"
            type="date"
            value={form.birthDate}
            onChange={update("birthDate")}
          />
          <FormField
            label="성별"
            type="select"
            value={form.gender}
            onChange={update("gender")}
            options={genderOptions}
          />
          <FormField
            label="전화번호"
            value={form.phone}
            onChange={update("phone")}
            placeholder="010-0000-0000"
          />
          <FormField
            label="주소"
            value={form.address}
            onChange={update("address")}
            placeholder="주소"
          />
          <FormField
            label="등록유형"
            type="select"
            value={form.registrationType}
            onChange={update("registrationType")}
            options={registrationTypeOptions}
          />
          <FormField
            label="돌봄등급"
            type="select"
            value={form.careLevel}
            onChange={update("careLevel")}
            options={careLevelOptions}
          />
          <FormField
            label="소득수준"
            type="select"
            value={form.incomeLevel}
            onChange={update("incomeLevel")}
            options={incomeLevelOptions}
          />
        </div>
      </Panel>
    </>
  );
}
