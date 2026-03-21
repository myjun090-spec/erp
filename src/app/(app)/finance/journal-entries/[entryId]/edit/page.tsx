"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { getJournalEntryOriginLabel } from "@/lib/journal-entry-origin";

type JournalEntryDoc = {
  _id: string;
  voucherNo: string;
  originType: string;
  status: string;
  journalDate: string;
  description?: string;
  customerSnapshot?: { code?: string; name?: string } | null;
  projectSnapshot?: { name?: string } | null;
  contractSnapshot?: { contractNo?: string; title?: string } | null;
  wbsSnapshot?: { name?: string } | null;
  budgetSnapshot?: { budgetCode?: string; version?: string } | null;
  accountingUnitSnapshot?: { accountingUnitId?: string; name?: string } | null;
  accountSnapshot?: { accountCode?: string; accountName?: string } | null;
  totalDebit?: number;
  totalCredit?: number;
  sourceSnapshot?: { refNo?: string } | null;
};

type AccountingUnitOption = {
  _id: string;
  code: string;
  name: string;
};

type AccountOption = {
  _id: string;
  accountCode: string;
  accountName: string;
  parentAccountCode?: string | null;
  postingAllowed?: boolean;
  status?: string;
};

export default function JournalEntryEditPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<JournalEntryDoc | null>(null);
  const [accountingUnits, setAccountingUnits] = useState<AccountingUnitOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [form, setForm] = useState({
    journalDate: "",
    description: "",
    accountingUnitId: "",
    accountId: "",
  });
  const parentAccountCodes = new Set(
    accounts
      .map((account) => account.parentAccountCode || "")
      .filter((accountCode) => Boolean(accountCode)),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [entryRes, unitsRes, accountsRes] = await Promise.all([
          fetch(`/api/journal-entries/${entryId}`),
          fetch("/api/accounting-units"),
          fetch("/api/accounts"),
        ]);
        const [entryJson, unitsJson, accountsJson] = await Promise.all([
          entryRes.json(),
          unitsRes.json(),
          accountsRes.json(),
        ]);

        if (cancelled) {
          return;
        }

        if (!entryJson.ok) {
          pushToast({
            title: "전표 조회 실패",
            description: entryJson.message || "전표를 불러오지 못했습니다.",
            tone: "warning",
          });
          router.push("/finance/journal-entries");
          return;
        }

        const nextDoc = entryJson.data as JournalEntryDoc;
        setDoc(nextDoc);
        setAccountingUnits(unitsJson.ok ? unitsJson.data.items ?? [] : []);
        setAccounts(accountsJson.ok ? accountsJson.data.items ?? [] : []);
        setForm({
          journalDate: nextDoc.journalDate || "",
          description: nextDoc.description || "",
          accountingUnitId: nextDoc.accountingUnitSnapshot?.accountingUnitId || "",
          accountId:
            (accountsJson.ok
              ? (accountsJson.data.items ?? []).find(
                  (account: AccountOption) =>
                    account.accountCode === nextDoc.accountSnapshot?.accountCode,
                )?._id
              : "") || "",
        });
      } catch {
        if (!cancelled) {
          pushToast({
            title: "전표 조회 실패",
            description: "전표 정보를 불러오는 중 오류가 발생했습니다.",
            tone: "warning",
          });
          router.push("/finance/journal-entries");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entryId, pushToast, router]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  async function handleSubmit() {
    if (!form.journalDate || !form.accountingUnitId || !form.accountId) {
      pushToast({
        title: "필수 입력",
        description: "전표일, 회계단위, 계정과목을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/journal-entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalDate: form.journalDate,
          description: form.description,
          accountingUnitId: form.accountingUnitId,
          accountId: form.accountId,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "저장 실패",
          description: json.message || "전표를 수정하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "저장 완료",
        description: "전표 초안을 업데이트했습니다.",
        tone: "success",
      });
      router.push(`/finance/journal-entries/${entryId}`);
    } catch {
      pushToast({
        title: "저장 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !doc) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={doc.voucherNo}
        description="원천 문서로 생성된 전표 초안을 검토하고 회계단위/계정과목을 보완합니다."
        actions={
          <>
            <Link
              href={`/finance/journal-entries/${entryId}`}
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
          <FormField label="전표번호" type="readonly" value={doc.voucherNo} />
          <FormField label="원천" type="readonly" value={getJournalEntryOriginLabel(doc.originType)} />
          <FormField label="참조 문서" type="readonly" value={doc.sourceSnapshot?.refNo || "-"} />
          <FormField
            label="고객"
            type="readonly"
            value={
              doc.customerSnapshot
                ? `${doc.customerSnapshot.code || "-"} · ${doc.customerSnapshot.name || "-"}`
                : "-"
            }
          />
          <FormField label="프로젝트" type="readonly" value={doc.projectSnapshot?.name || "-"} />
          <FormField
            label="계약"
            type="readonly"
            value={
              doc.contractSnapshot
                ? `${doc.contractSnapshot.contractNo || "-"} · ${doc.contractSnapshot.title || "-"}`
                : "-"
            }
          />
          <FormField label="WBS" type="readonly" value={doc.wbsSnapshot?.name || "-"} />
          <FormField
            label="예산 버전"
            type="readonly"
            value={
              doc.budgetSnapshot
                ? `${doc.budgetSnapshot.budgetCode || "-"} · ${doc.budgetSnapshot.version || "-"}`
                : "-"
            }
          />
          <FormField label="차변 합계" type="readonly" value={(doc.totalDebit || 0).toLocaleString()} />
          <FormField label="대변 합계" type="readonly" value={(doc.totalCredit || 0).toLocaleString()} />
          <DatePicker label="전표일" required value={form.journalDate} onChange={update("journalDate")} />
          <FormField
            label="회계단위"
            required
            type="select"
            value={form.accountingUnitId}
            onChange={update("accountingUnitId")}
            options={accountingUnits.map((unit) => ({
              value: unit._id,
              label: `${unit.code} · ${unit.name}`,
            }))}
          />
          <FormField
            label="계정과목"
            required
            type="select"
            value={form.accountId}
            onChange={update("accountId")}
            options={accounts
              .filter(
                (account) =>
                  account.postingAllowed !== false &&
                  account.status !== "inactive" &&
                  !parentAccountCodes.has(account.accountCode),
              )
              .map((account) => ({
                value: account._id,
                label: `${account.accountCode} · ${account.accountName}`,
              }))}
          />
          <FormField
            label="적요"
            value={form.description}
            onChange={update("description")}
            placeholder="전표 적요"
          />
        </div>
      </Panel>
    </>
  );
}
