"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BudgetLinkFields } from "@/components/domain/budget-link-fields";
import { PageHeader } from "@/components/layout/page-header";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast-provider";
import { generateJournalEntryNo } from "@/lib/document-numbers";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type ApDuplicateGuardItem = {
  _id: string;
  invoiceNo: string;
  totalAmount: number;
  status: string;
  budgetSnapshot: {
    budgetId?: string;
    version?: string;
  } | null;
  journalEntrySnapshot: {
    journalEntryId?: string;
    voucherNo?: string;
    status?: string;
  } | null;
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

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [wbsId, setWbsId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [apLinkedInvoices, setApLinkedInvoices] = useState<ApDuplicateGuardItem[]>([]);
  const [accountingUnits, setAccountingUnits] = useState<AccountingUnitOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [form, setForm] = useState({
    voucherNo: generateJournalEntryNo(),
    journalType: "general",
    journalDate: getToday(),
    accountingUnitId: "",
    accountId: "",
    totalDebit: "",
    totalCredit: "",
    description: "",
  });

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "totalDebit" || key === "totalCredit"
          ? formatIntegerInput(value)
          : value,
    }));
  };

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [unitsRes, accountsRes] = await Promise.all([
          fetch("/api/accounting-units"),
          fetch("/api/accounts"),
        ]);
        const [unitsJson, accountsJson] = await Promise.all([
          unitsRes.json(),
          accountsRes.json(),
        ]);

        if (cancelled) {
          return;
        }

        setAccountingUnits(unitsJson.ok ? unitsJson.data.items ?? [] : []);
        setAccounts(accountsJson.ok ? accountsJson.data.items ?? [] : []);
      } catch {
        if (!cancelled) {
          setAccountingUnits([]);
          setAccounts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setApLinkedInvoices([]);
      return;
    }

    const controller = new AbortController();

    async function loadApLinkedInvoices() {
      try {
        const response = await fetch(appendFacilityIdToPath("/api/finance", projectId), {
          signal: controller.signal,
        });
        const json = await response.json();

        if (!controller.signal.aborted && json.ok) {
          setApLinkedInvoices(json.data?.apInvoices ?? []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setApLinkedInvoices([]);
        }
      }
    }

    void loadApLinkedInvoices();
    return () => controller.abort();
  }, [projectId]);

  const enteredDebit = parseFormattedInteger(form.totalDebit);
  const enteredCredit = parseFormattedInteger(form.totalCredit);
  const enteredAmount = Math.max(enteredDebit, enteredCredit);
  const sameBudgetLinkedApInvoices = useMemo(
    () =>
      apLinkedInvoices.filter(
        (item) =>
          ["approved", "partial-paid", "paid"].includes(item.status) &&
          item.budgetSnapshot &&
          item.budgetSnapshot.budgetId === budgetId,
      ),
    [apLinkedInvoices, budgetId],
  );
  const exactDuplicateCandidate = useMemo(
    () =>
      sameBudgetLinkedApInvoices.find(
        (item) =>
          enteredAmount > 0 &&
          item.totalAmount === enteredAmount &&
          item.journalEntrySnapshot?.journalEntryId,
      ) ?? null,
    [enteredAmount, sameBudgetLinkedApInvoices],
  );
  const parentAccountCodes = new Set(
    accounts
      .map((account) => account.parentAccountCode || "")
      .filter((accountCode) => Boolean(accountCode)),
  );
  const filteredAccounts = accounts.filter(
    (account) =>
      account.postingAllowed !== false &&
      account.status === "active" &&
      !parentAccountCodes.has(account.accountCode),
  );
  const isBalanced = enteredDebit > 0 && enteredDebit === enteredCredit;
  const differenceAmount = Math.abs(enteredDebit - enteredCredit);

  const handleSubmit = async () => {
    if (
      !projectId ||
      !wbsId ||
      !budgetId ||
      !form.journalType ||
      !form.journalDate ||
      !form.accountingUnitId ||
      !form.accountId
    ) {
      pushToast({
        title: "필수 입력",
        description:
          "프로젝트, WBS, 실행예산, 전표유형, 전표일, 회계단위, 계정과목을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (!isBalanced) {
      pushToast({
        title: "차변/대변 불일치",
        description: "차변과 대변 합계가 같아야 전표를 저장할 수 있습니다.",
        tone: "warning",
      });
      return;
    }

    if (exactDuplicateCandidate) {
      pushToast({
        title: "AP 연계 전표 중복 가능",
        description: `${exactDuplicateCandidate.invoiceNo}는 이미 ${exactDuplicateCandidate.journalEntrySnapshot?.voucherNo || "자동 생성 전표"}로 연결돼 있습니다. 수기 전표 대신 AP 연계 전표를 수정해 주세요.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherNo: form.voucherNo.trim(),
          projectId,
          wbsId,
          budgetId,
          journalType: form.journalType,
          journalDate: form.journalDate,
          accountingUnitId: form.accountingUnitId,
          accountId: form.accountId,
          totalDebit: enteredDebit,
          totalCredit: enteredCredit,
          description: form.description.trim(),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        pushToast({
          title: "등록 완료",
          description: "전표가 등록되었습니다.",
          tone: "success",
        });
        router.push("/finance/journal-entries");
        return;
      }

      pushToast({
        title: "등록 실패",
        description: json.message || "전표를 저장하지 못했습니다.",
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

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="전표 등록"
        description="전표와 실행예산 연결, 회계단위, 계정과목을 함께 등록합니다."
        actions={
          <>
            <Link
              href="/finance/journal-entries"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || loadingOptions}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />

      <Panel className="p-5">
        <BudgetLinkFields
          projectId={projectId}
          wbsId={wbsId}
          budgetId={budgetId}
          onProjectChange={setProjectId}
          onWbsChange={setWbsId}
          onBudgetChange={setBudgetId}
        />
        {sameBudgetLinkedApInvoices.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-[rgba(161,92,7,0.16)] bg-[rgba(255,243,214,0.62)] px-4 py-4 text-sm text-[color:var(--text)]">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--warning)]">
              AP 연계 주의
            </div>
            <p className="mt-2 leading-7 text-[color:var(--text-muted)]">
              선택한 실행예산 버전에 승인된 AP가 {sameBudgetLinkedApInvoices.length}건 있습니다. 매입 건은 수기 전표 대신 AP 승인으로 자동 생성된 전표 초안을 사용하는 것이 원칙입니다.
            </p>
            <div className="mt-3 space-y-2">
              {sameBudgetLinkedApInvoices.slice(0, 3).map((item) => (
                <div
                  key={item._id}
                  className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3 text-xs text-[color:var(--text-muted)]"
                >
                  <div className="font-medium text-[color:var(--text)]">
                    {item.invoiceNo} · {formatIntegerInput(item.totalAmount)}원
                  </div>
                  <div className="mt-1">
                    {item.journalEntrySnapshot?.voucherNo
                      ? `자동 전표 ${item.journalEntrySnapshot.voucherNo} · ${item.journalEntrySnapshot.status || "draft"}`
                      : "자동 전표 연결 대기"}
                  </div>
                </div>
              ))}
            </div>
            {exactDuplicateCandidate ? (
              <p className="mt-3 font-medium text-[color:var(--danger)]">
                현재 입력 금액은 {exactDuplicateCandidate.invoiceNo}와 동일해 중복 전표로 판단되어 저장이 차단됩니다.
              </p>
            ) : null}
          </div>
        ) : null}
        {!isBalanced ? (
          <div className="mt-6 rounded-2xl border border-[rgba(201,55,44,0.16)] bg-[rgba(252,235,235,0.68)] px-4 py-4 text-sm text-[color:var(--text)]">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--danger)]">
              균형 확인 필요
            </div>
            <p className="mt-2 leading-7 text-[color:var(--text-muted)]">
              차변과 대변 합계가 같아야 전표를 저장할 수 있습니다. 현재 차이 금액은 {differenceAmount.toLocaleString()}원입니다.
            </p>
          </div>
        ) : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="전표번호" required type="readonly" value={form.voucherNo} />
          <FormField
            label="전표유형"
            required
            type="select"
            value={form.journalType}
            onChange={update("journalType")}
            options={[
              { label: "일반", value: "general" },
              { label: "수정", value: "adjusting" },
              { label: "결산", value: "closing" },
            ]}
          />
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
            options={filteredAccounts.map((account) => ({
              value: account._id,
              label: `${account.accountCode} · ${account.accountName}`,
            }))}
          />
          <FormField
            label="차변 합계"
            type="text"
            inputMode="numeric"
            value={form.totalDebit}
            onChange={update("totalDebit")}
            placeholder="0"
          />
          <FormField
            label="대변 합계"
            type="text"
            inputMode="numeric"
            value={form.totalCredit}
            onChange={update("totalCredit")}
            placeholder="0"
          />
          <FormField
            label="적요"
            value={form.description}
            onChange={update("description")}
            placeholder="전표 적요"
            className="md:col-span-2 lg:col-span-3"
          />
        </div>
      </Panel>
    </>
  );
}
