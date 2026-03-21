"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput, normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
import { isValidEmailAddress, normalizeEmailAddress } from "@/lib/email-address";
import { formatMobilePhoneInput, normalizeMobilePhoneForSave } from "@/lib/phone-number";

type QualificationDraft = {
  itemIndex: number | null;
  type: string;
  certNo: string;
  validTo: string;
  status: string;
};

type QualificationItem = {
  type: string;
  certNo: string;
  validTo: string;
  status: string;
};

type VendorDetail = {
  _id: string;
  code: string;
  name: string;
  legalName: string;
  taxId: string;
  country: string;
  contacts: Array<{ name: string; position: string; phone: string; email: string }>;
  qualifications: QualificationItem[];
};

const emptyQualificationDraft: QualificationDraft = {
  itemIndex: null,
  type: "",
  certNo: "",
  validTo: "",
  status: "valid",
};

export default function VendorEditPage() {
  const router = useRouter();
  const { vendorId } = useParams<{ vendorId: string }>();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualificationDrawerOpen, setQualificationDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
  });
  const [existingContacts, setExistingContacts] = useState<
    Array<{ name: string; position: string; phone: string; email: string }>
  >([]);
  const [qualifications, setQualifications] = useState<QualificationItem[]>([]);
  const [qualificationDraft, setQualificationDraft] =
    useState<QualificationDraft>(emptyQualificationDraft);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/vendors/${vendorId}`);
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "공급업체를 불러오지 못했습니다.");
          return;
        }

        const doc = json.data as VendorDetail;
        const contacts = Array.isArray(doc.contacts) ? doc.contacts : [];
        const primaryContact = contacts[0];
        setForm({
          code: doc.code || "",
          name: doc.name || "",
          legalName: doc.legalName || "",
          taxId: formatBusinessTaxIdInput(doc.taxId),
          country: doc.country || "KR",
          contactName: primaryContact?.name || "",
          contactPosition: primaryContact?.position || "",
          contactPhone: formatMobilePhoneInput(primaryContact?.phone),
          contactEmail: primaryContact?.email || "",
        });
        setExistingContacts(contacts);
        setQualifications(Array.isArray(doc.qualifications) ? doc.qualifications : []);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [vendorId]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "taxId"
          ? formatBusinessTaxIdInput(value)
          : key === "contactPhone"
            ? formatMobilePhoneInput(value)
            : value,
    }));
  };

  const updateQualificationDraft =
    (key: keyof Omit<QualificationDraft, "itemIndex">) => (value: string) => {
      setQualificationDraft((current) => ({
        ...current,
        [key]: value,
      }));
    };

  const closeQualificationDrawer = () => {
    setQualificationDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setQualificationDraft(emptyQualificationDraft);
  };

  const openNewQualificationDrawer = () => {
    setQualificationDraft(emptyQualificationDraft);
    setDeleteConfirmOpen(false);
    setQualificationDrawerOpen(true);
  };

  const openEditQualificationDrawer = (item: QualificationItem, index: number) => {
    setQualificationDraft({
      itemIndex: index,
      type: item.type,
      certNo: item.certNo,
      validTo: item.validTo,
      status: item.status,
    });
    setDeleteConfirmOpen(false);
    setQualificationDrawerOpen(true);
  };

  const handleSaveQualification = () => {
    if (!qualificationDraft.type.trim()) {
      pushToast({
        title: "필수 입력",
        description: "인증유형을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextItem: QualificationItem = {
      type: qualificationDraft.type.trim(),
      certNo: qualificationDraft.certNo.trim(),
      validTo: qualificationDraft.validTo,
      status: qualificationDraft.status || "valid",
    };

    setQualifications((current) =>
      qualificationDraft.itemIndex === null
        ? [nextItem, ...current]
        : current.map((item, index) =>
            index === qualificationDraft.itemIndex ? nextItem : item,
          ),
    );

    closeQualificationDrawer();
  };

  const handleDeleteQualification = () => {
    if (qualificationDraft.itemIndex === null) {
      return;
    }

    setQualifications((current) =>
      current.filter((_item, index) => index !== qualificationDraft.itemIndex),
    );
    closeQualificationDrawer();
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      pushToast({
        title: "필수 입력",
        description: "업체명을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const normalizedContactEmail = normalizeEmailAddress(form.contactEmail);
    if (normalizedContactEmail && !isValidEmailAddress(normalizedContactEmail)) {
      pushToast({
        title: "이메일 형식 오류",
        description: "이메일은 name@example.com 형식으로 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const normalizedContactPhone = normalizeMobilePhoneForSave(form.contactPhone);
    const primaryContact =
      form.contactName.trim() || form.contactPosition.trim() || normalizedContactPhone || normalizedContactEmail
        ? {
            name: form.contactName.trim(),
            position: form.contactPosition.trim(),
            phone: normalizedContactPhone,
            email: normalizedContactEmail,
          }
        : null;
    const contacts = primaryContact
      ? [primaryContact, ...existingContacts.slice(1)]
      : existingContacts.slice(1);

    setSaving(true);
    try {
      const res = await fetch(`/api/parties/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          legalName: form.legalName.trim(),
          taxId: normalizeBusinessTaxIdForSave(form.taxId),
          country: form.country,
          contacts,
          qualifications,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        pushToast({
          title: "수정 완료",
          description: "공급업체가 업데이트되었습니다.",
          tone: "success",
        });
        router.push(`/supply-chain/vendors/${vendorId}`);
        return;
      }

      pushToast({
        title: "수정 실패",
        description: json.message || "공급업체를 수정하지 못했습니다.",
        tone: "warning",
      });
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="공급업체 로딩 중"
        description="공급업체 정보를 불러오고 있습니다."
      />
    );
  }

  if (error) {
    return <StatePanel variant="error" title="공급업체 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title="공급업체 수정"
        description="공급업체 기본정보와 적격심사 인증 정보를 수정합니다."
        actions={
          <>
            <Link
              href={`/supply-chain/vendors/${vendorId}`}
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
          <FormField label="업체코드" required type="readonly" value={form.code} />
          <FormField label="업체명" required value={form.name} onChange={update("name")} placeholder="업체 명칭" />
          <FormField label="법인명" value={form.legalName} onChange={update("legalName")} placeholder="법인정식명칭" />
          <FormField
            label="사업자번호"
            type="text"
            inputMode="numeric"
            value={form.taxId}
            onChange={update("taxId")}
            placeholder="000-00-00000"
          />
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
        <div className="mt-6 border-t border-[color:var(--border)] pt-6">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">주요 담당자</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              label="담당자명"
              value={form.contactName}
              onChange={update("contactName")}
              placeholder="홍길동"
            />
            <FormField
              label="직책"
              value={form.contactPosition}
              onChange={update("contactPosition")}
              placeholder="영업팀장"
            />
            <FormField
              label="전화번호"
              type="text"
              inputMode="numeric"
              value={form.contactPhone}
              onChange={update("contactPhone")}
              placeholder="010-0000-0000"
            />
            <FormField
              label="이메일"
              type="email"
              value={form.contactEmail}
              onChange={update("contactEmail")}
              placeholder="name@example.com"
            />
          </div>
        </div>
      </Panel>

      <div className="mt-6">
        <DataTable
          title="인증"
          description="공급업체 적격심사와 인증 정보를 관리합니다."
          actions={
            <button
              type="button"
              onClick={openNewQualificationDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              인증 추가
            </button>
          }
          columns={[
            { key: "type", label: "인증유형" },
            { key: "certNo", label: "인증번호" },
            { key: "validTo", label: "유효기한" },
            { key: "status", label: "상태" },
          ]}
          rows={qualifications.map((item, index) => ({
            id: `qualification-${index}`,
            itemIndex: index,
            typeValue: item.type,
            type: <span className="font-medium">{item.type}</span>,
            certNo: <span className="font-mono">{item.certNo || "-"}</span>,
            validTo: item.validTo || "-",
            status: (
              <StatusBadge
                label={item.status === "valid" ? "적격" : item.status}
                tone={item.status === "valid" ? "success" : "warning"}
              />
            ),
          }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            const itemIndex = Number(row.itemIndex);
            const item = qualifications[itemIndex];

            if (item) {
              openEditQualificationDrawer(item, itemIndex);
            }
          }}
          getRowAriaLabel={(row) => `${String(row.typeValue)} 인증 수정 열기`}
          emptyState={{
            title: "등록된 인증이 없습니다",
            description: "필요한 적격심사나 인증을 추가해 관리할 수 있습니다.",
            action: (
              <button
                type="button"
                onClick={openNewQualificationDrawer}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                인증 추가
              </button>
            ),
          }}
        />
      </div>

      <Drawer
        open={qualificationDrawerOpen}
        onClose={closeQualificationDrawer}
        eyebrow="Qualification"
        title={qualificationDraft.itemIndex === null ? "인증 추가" : "인증 수정"}
        description="공급업체 적격심사 또는 보유 인증 정보를 입력합니다."
        footer={
          <>
            {qualificationDraft.itemIndex !== null ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={saving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeQualificationDrawer}
              disabled={saving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveQualification}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {qualificationDraft.itemIndex === null ? "추가 저장" : "수정 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="인증유형"
            required
            value={qualificationDraft.type}
            onChange={updateQualificationDraft("type")}
            placeholder="예: ASME Section III"
          />
          <FormField
            label="인증번호"
            value={qualificationDraft.certNo}
            onChange={updateQualificationDraft("certNo")}
            placeholder="예: ASME-U-12345"
          />
          <DatePicker label="유효기한" value={qualificationDraft.validTo} onChange={updateQualificationDraft("validTo")} />
          <FormField
            label="상태"
            type="select"
            value={qualificationDraft.status}
            onChange={updateQualificationDraft("status")}
            options={[
              { label: "적격", value: "valid" },
              { label: "만료", value: "expired" },
              { label: "검토중", value: "review" },
            ]}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="인증을 삭제할까요?"
        description="삭제한 인증 항목은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteQualification}
      />
    </>
  );
}
