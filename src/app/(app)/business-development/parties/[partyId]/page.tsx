"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput } from "@/lib/business-tax-id";
import { isValidEmailAddress, normalizeEmailAddress } from "@/lib/email-address";
import { canAccessAction } from "@/lib/navigation";
import { formatMobilePhoneInput, normalizeMobilePhoneForSave } from "@/lib/phone-number";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

type ContactDraft = {
  contactIndex: number | null;
  name: string;
  position: string;
  phone: string;
  email: string;
};

const emptyContactDraft: ContactDraft = {
  contactIndex: null,
  name: "",
  position: "",
  phone: "010",
  email: "",
};

function formatTextValue(value: unknown, fallback = "미기재") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function formatAddressValue(address: Doc) {
  const line = formatTextValue(address.line, "");
  const postalCode = formatTextValue(address.postalCode, "");

  if (line && postalCode) {
    return `${line} (${postalCode})`;
  }

  if (line) {
    return line;
  }

  if (postalCode) {
    return `미입력 (${postalCode})`;
  }

  return "미기재";
}

export default function PartyDetailPage() {
  const router = useRouter();
  const { partyId } = useParams<{ partyId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContactDraft);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`/api/parties/${partyId}`); const json = await res.json(); if (json.ok) setDoc(json.data); else setError(json.message); }
    catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [partyId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">로딩 중...</div>;
  if (error || !doc) return <div className="flex flex-col items-center justify-center py-20"><h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2><Link href="/business-development/parties" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link></div>;

  const contacts = doc.contacts || [];
  const addresses = doc.addresses || [];
  const canUpdateParty = canAccessAction(viewerPermissions, "party.update");
  const tabItems = [
    { value: "overview", label: "기본정보", caption: "거래처 상세" },
    { value: "contacts", label: "연락처", count: contacts.length, caption: "담당자 연락처" },
  ];

  const closeContactDrawer = () => {
    setContactDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setContactDraft(emptyContactDraft);
  };

  const openNewContactDrawer = () => {
    setContactDraft(emptyContactDraft);
    setDeleteConfirmOpen(false);
    setContactDrawerOpen(true);
  };

  const openEditContactDrawer = (contact: Doc, index: number) => {
    setContactDraft({
      contactIndex: index,
      name: formatTextValue(contact.name, ""),
      position: formatTextValue(contact.position, ""),
      phone: formatMobilePhoneInput(contact.phone),
      email: formatTextValue(contact.email, ""),
    });
    setDeleteConfirmOpen(false);
    setContactDrawerOpen(true);
  };

  const updateContactDraft =
    (key: keyof Omit<ContactDraft, "contactIndex">) => (value: string) => {
      setContactDraft((current) => ({
        ...current,
        [key]: key === "phone" ? formatMobilePhoneInput(value) : value,
      }));
    };

  const syncContacts = async (nextContacts: Doc[], actionLabel: string) => {
    setContactSaving(true);
    try {
      const res = await fetch(`/api/parties/${partyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: nextContacts }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: `${actionLabel} 실패`,
          description: json.message || "연락처를 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeContactDrawer();
      pushToast({
        title: actionLabel,
        description: "연락처가 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: `${actionLabel} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setContactSaving(false);
    }
  };

  const handleSaveContact = async () => {
    const normalizedContactPhone = normalizeMobilePhoneForSave(contactDraft.phone);
    const normalizedContactEmail = normalizeEmailAddress(contactDraft.email);

    if (!contactDraft.name.trim() && !normalizedContactPhone && !contactDraft.email.trim()) {
      pushToast({
        title: "필수 항목",
        description: "담당자명, 전화번호, 이메일 중 하나 이상 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (normalizedContactEmail && !isValidEmailAddress(normalizedContactEmail)) {
      pushToast({
        title: "이메일 형식 오류",
        description: "이메일은 name@example.com 형식으로 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextContact = {
      name: contactDraft.name.trim(),
      position: contactDraft.position.trim(),
      phone: normalizedContactPhone,
      email: normalizedContactEmail,
    };

    const nextContacts =
      contactDraft.contactIndex === null
        ? [nextContact, ...contacts]
        : contacts.map((contact: Doc, index: number) =>
            index === contactDraft.contactIndex ? nextContact : contact,
          );

    await syncContacts(nextContacts, contactDraft.contactIndex === null ? "연락처 추가 완료" : "연락처 수정 완료");
  };

  const handleDeleteContact = async () => {
    if (contactDraft.contactIndex === null) {
      return;
    }

    const nextContacts = contacts.filter(
      (_contact: Doc, index: number) => index !== contactDraft.contactIndex,
    );

    await syncContacts(nextContacts, "연락처 삭제 완료");
  };

  const handleArchiveParty = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/parties/${partyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "거래처 보관 실패",
          description: json.message || "거래처를 보관하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setArchiveConfirmOpen(false);
      pushToast({
        title: "거래처 보관 완료",
        description: "거래처가 목록에서 제외되도록 보관 처리되었습니다.",
        tone: "success",
      });
      router.push("/business-development/parties");
    } catch {
      pushToast({
        title: "거래처 보관 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Business Development" title={doc.name} description={`${doc.code} · ${doc.legalName || ""}`}
        meta={[{ label: "Database", tone: "success" }, ...(doc.partyRoles || []).map((r: string) => ({ label: r, tone: (r === "customer" ? "info" : r === "vendor" ? "warning" : "default") as "info"|"warning"|"default" })), { label: doc.status, tone: doc.status === "active" ? "success" : "default" as "success"|"default" }]}
        actions={<><Link href="/business-development/parties" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link><PermissionLink permission="party.update" href={`/business-development/parties/${doc._id}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">수정</PermissionLink>{doc.status !== "archived" ? <PermissionButton permission="party.archive" type="button" onClick={() => setArchiveConfirmOpen(true)} className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]">보관</PermissionButton> : null}</>} />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="코드" value={doc.code} /><DetailField label="거래처명" value={doc.name} />
              <DetailField label="법인명" value={formatTextValue(doc.legalName)} /><DetailField label="사업자번호" value={doc.taxId ? formatBusinessTaxIdInput(doc.taxId) : "미기재"} />
              <DetailField label="국가" value={formatTextValue(doc.country)} /><DetailField label="유형" value={(doc.partyRoles || []).map((r: string) => <StatusBadge key={r} label={r} tone="info" />)} />
            </dl></Panel>
          <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">주소</h3>
            <dl className="grid gap-4">
              {addresses.length > 0 ? addresses.map((addr: Doc, index: number) => (
                <div key={addr.type || `address-${index}`}>
                  <DetailField
                    label={formatTextValue(addr.type, "주소")}
                    value={formatAddressValue(addr)}
                  />
                </div>
              )) : (
                <DetailField label="주소" value="미기재" />
              )}
            </dl></Panel>
        </div>)}
      {activeTab === "contacts" && (
        <DataTable title="연락처" description="거래처 담당자 연락처입니다."
          actions={
            <PermissionButton
              permission="party.update"
              type="button"
              onClick={openNewContactDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              연락처 추가
            </PermissionButton>
          }
          columns={[{ key: "name", label: "이름" }, { key: "position", label: "직급" }, { key: "phone", label: "전화" }, { key: "email", label: "이메일" }]}
          rows={contacts.map((c: Doc, index: number) => ({ id: `contact-${index}`, contactIndex: index, nameValue: formatTextValue(c.name), name: <span className="font-medium">{formatTextValue(c.name)}</span>, position: formatTextValue(c.position, "미입력"), phone: formatTextValue(c.phone, "미입력"), email: formatTextValue(c.email, "미입력") }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={canUpdateParty ? (row) => openEditContactDrawer(contacts[Number(row.contactIndex)], Number(row.contactIndex)) : undefined}
          getRowAriaLabel={(row) => `${String(row.nameValue)} 연락처 편집 열기`}
          emptyState={{
            title: "등록된 연락처가 없습니다",
            description: "연락처 추가로 담당자 정보를 등록해 주세요.",
            action: (
              <PermissionButton
                permission="party.update"
                type="button"
                onClick={openNewContactDrawer}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                연락처 추가
              </PermissionButton>
            ),
          }}
        />)}

      <Drawer
        open={contactDrawerOpen}
        onClose={closeContactDrawer}
        eyebrow="Contact"
        title={contactDraft.contactIndex === null ? "연락처 추가" : "연락처 수정"}
        description="거래처 담당자 이름, 직급, 전화번호, 이메일을 관리합니다."
        footer={
          <>
            {contactDraft.contactIndex !== null ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={contactSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeContactDrawer}
              disabled={contactSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveContact()}
              disabled={contactSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {contactSaving ? "저장 중..." : contactDraft.contactIndex === null ? "추가 저장" : "수정 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="담당자명"
            value={contactDraft.name}
            onChange={updateContactDraft("name")}
            placeholder="담당자명"
          />
          <FormField
            label="직급"
            value={contactDraft.position}
            onChange={updateContactDraft("position")}
            placeholder="구매팀장"
          />
          <FormField
            label="전화번호"
            type="text"
            inputMode="numeric"
            value={contactDraft.phone}
            onChange={updateContactDraft("phone")}
            placeholder="010-0000-0000"
          />
          <FormField
            label="이메일"
            type="email"
            value={contactDraft.email}
            onChange={updateContactDraft("email")}
            placeholder="name@company.com"
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="연락처를 삭제할까요?"
        description="선택한 연락처는 거래처 상세의 연락처 목록에서 제거됩니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteContact()}
      />
      <ConfirmDialog
        open={archiveConfirmOpen}
        title="거래처를 보관할까요?"
        description="보관된 거래처는 거래처 목록에서 제외됩니다."
        confirmLabel={archiving ? "보관 중..." : "보관"}
        tone="danger"
        onClose={() => {
          if (!archiving) {
            setArchiveConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleArchiveParty()}
      />
    </>
  );
}
