"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput, normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
import { generatePartyCode, generateVendorCode } from "@/lib/document-numbers";
import { isValidEmailAddress, normalizeEmailAddress } from "@/lib/email-address";
import { formatMobilePhoneInput, normalizeMobilePhoneForSave } from "@/lib/phone-number";

const partyRoleOptions = [
  { label: "고객", value: "customer" },
  { label: "공급업체", value: "vendor" },
  { label: "파트너", value: "partner" },
  { label: "제작사", value: "manufacturer" },
];

function toggleRole(roles: string[], role: string) {
  return roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
}

export default function PartyNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: generatePartyCode(),
    name: "",
    legalName: "",
    taxId: "",
    country: "KR",
    contactName: "",
    contactPosition: "",
    contactPhone: "010",
    contactEmail: "",
    addressType: "사업장",
    addressLine: "",
    postalCode: "",
  });
  const [partyRoles, setPartyRoles] = useState<string[]>(["customer"]);

  const syncGeneratedCode = (roles: string[]) => {
    const vendorOnly = roles.length > 0 && roles.every((role) => role === "vendor");
    setForm((prev) => ({
      ...prev,
      code: vendorOnly ? generateVendorCode() : generatePartyCode(),
    }));
  };

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateContactPhone = (value: string) => {
    setForm((prev) => ({ ...prev, contactPhone: formatMobilePhoneInput(value) }));
  };

  const updateTaxId = (value: string) => {
    setForm((prev) => ({ ...prev, taxId: formatBusinessTaxIdInput(value) }));
  };

  const handleSubmit = async () => {
    if (!form.name || partyRoles.length === 0) {
      pushToast({
        title: "필수 입력",
        description: "거래처명과 거래처 유형을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    const normalizedContactPhone = normalizeMobilePhoneForSave(form.contactPhone);
    const normalizedTaxId = normalizeBusinessTaxIdForSave(form.taxId);
    const normalizedContactEmail = normalizeEmailAddress(form.contactEmail);
    if (normalizedContactEmail && !isValidEmailAddress(normalizedContactEmail)) {
      pushToast({
        title: "이메일 형식 오류",
        description: "이메일은 name@example.com 형식으로 입력해 주세요.",
        tone: "warning",
      });
      return;
    }
    const contacts = form.contactName || form.contactEmail || normalizedContactPhone
      ? [
          {
            name: form.contactName,
            position: form.contactPosition,
            phone: normalizedContactPhone,
            email: normalizedContactEmail,
          },
        ]
      : [];

    const addresses = form.addressLine || form.postalCode
      ? [
          {
            type: form.addressType,
            line: form.addressLine,
            postalCode: form.postalCode,
          },
        ]
      : [];

    setSaving(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          legalName: form.legalName,
          taxId: normalizedTaxId,
          country: form.country,
          partyRoles,
          contacts,
          addresses,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "거래처가 등록되었습니다.", tone: "success" });
        router.push("/business-development/parties");
        return;
      }
      pushToast({ title: "등록 실패", description: json.message || "거래처를 저장하지 못했습니다.", tone: "warning" });
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="거래처 등록"
        description="고객, 공급업체, 파트너, 제작사를 통합 거래처 마스터로 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link
              href="/business-development/parties"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="거래처코드" required type="readonly" value={form.code} />
            <FormField label="거래처명" required value={form.name} onChange={update("name")} placeholder="거래처명" />
            <FormField label="법인명" value={form.legalName} onChange={update("legalName")} placeholder="법인 정식명칭" />
            <FormField label="사업자번호" type="text" inputMode="numeric" value={form.taxId} onChange={updateTaxId} placeholder="000-00-00000" />
            <FormField
              label="국가"
              type="select"
              value={form.country}
              onChange={update("country")}
              options={[
                { label: "대한민국", value: "KR" },
                { label: "미국", value: "US" },
                { label: "일본", value: "JP" },
              ]}
            />
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
              거래처 유형
              <span className="ml-1 text-[color:var(--danger)]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {partyRoleOptions.map((option) => {
                const active = partyRoles.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setPartyRoles((prev) => {
                        const nextRoles = toggleRole(prev, option.value);
                        syncGeneratedCode(nextRoles);
                        return nextRoles;
                      })
                    }
                    className={active
                      ? "rounded-full border border-[color:var(--primary)] bg-[rgba(9,105,218,0.08)] px-3 py-2 text-sm font-semibold text-[color:var(--primary)]"
                      : "rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm font-semibold text-[color:var(--text-muted)]"}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본 연락처</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="담당자명" value={form.contactName} onChange={update("contactName")} placeholder="담당자명" />
            <FormField label="직책" value={form.contactPosition} onChange={update("contactPosition")} placeholder="구매팀장" />
            <FormField label="전화번호" type="text" inputMode="numeric" value={form.contactPhone} onChange={updateContactPhone} placeholder="010-0000-0000" />
            <FormField label="이메일" type="email" value={form.contactEmail} onChange={update("contactEmail")} placeholder="name@company.com" />
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본 주소</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="주소유형" value={form.addressType} onChange={update("addressType")} placeholder="사업장" />
            <FormField label="주소" className="md:col-span-2" value={form.addressLine} onChange={update("addressLine")} placeholder="서울시 ..." />
            <FormField label="우편번호" value={form.postalCode} onChange={update("postalCode")} placeholder="00000" />
          </div>
        </Panel>
      </div>
    </>
  );
}
