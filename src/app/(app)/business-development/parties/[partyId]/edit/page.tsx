"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput, normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
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

export default function PartyEditPage() {
  const router = useRouter();
  const { partyId } = useParams<{ partyId: string }>();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partyRoles, setPartyRoles] = useState<string[]>([]);
  const [existingContacts, setExistingContacts] = useState<
    Array<{ name: string; position: string; phone: string; email: string }>
  >([]);
  const [existingAddresses, setExistingAddresses] = useState<
    Array<{ type: string; line: string; postalCode: string }>
  >([]);
  const [form, setForm] = useState({
    code: "",
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/parties/${partyId}`);
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "거래처를 불러오지 못했습니다.");
          return;
        }
        const doc = json.data;
        const contacts = Array.isArray(doc.contacts) ? doc.contacts : [];
        const addresses = Array.isArray(doc.addresses) ? doc.addresses : [];
        const contact = contacts[0];
        const address = addresses[0];
        setForm({
          code: doc.code || "",
          name: doc.name || "",
          legalName: doc.legalName || "",
          taxId: formatBusinessTaxIdInput(doc.taxId),
          country: doc.country || "KR",
          contactName: contact?.name || "",
          contactPosition: contact?.position || "",
          contactPhone: formatMobilePhoneInput(contact?.phone),
          contactEmail: contact?.email || "",
          addressType: address?.type || "사업장",
          addressLine: address?.line || "",
          postalCode: address?.postalCode || "",
        });
        setExistingContacts(contacts);
        setExistingAddresses(addresses);
        setPartyRoles(Array.isArray(doc.partyRoles) ? doc.partyRoles : []);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [partyId]);

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
    const primaryContact = form.contactName || form.contactEmail || normalizedContactPhone
      ? {
          name: form.contactName,
          position: form.contactPosition,
          phone: normalizedContactPhone,
          email: normalizedContactEmail,
        }
      : null;

    const contacts = primaryContact
      ? [primaryContact, ...existingContacts.slice(1)]
      : existingContacts.slice(1);

    const primaryAddress = form.addressLine || form.postalCode
      ? {
          type: form.addressType,
          line: form.addressLine,
          postalCode: form.postalCode,
        }
      : null;

    const addresses = primaryAddress
      ? [primaryAddress, ...existingAddresses.slice(1)]
      : existingAddresses.slice(1);

    setSaving(true);
    try {
      const res = await fetch(`/api/parties/${partyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        pushToast({ title: "수정 완료", description: "거래처가 업데이트되었습니다.", tone: "success" });
        router.push(`/business-development/parties/${partyId}`);
        return;
      }
      pushToast({ title: "수정 실패", description: json.message || "거래처를 수정하지 못했습니다.", tone: "warning" });
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="거래처 로딩 중" description="거래처 정보를 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="거래처 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="거래처 수정"
        description="거래처 마스터와 기본 연락처/주소 정보를 수정합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link
              href={`/business-development/parties/${partyId}`}
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
                    onClick={() => setPartyRoles((prev) => toggleRole(prev, option.value))}
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
