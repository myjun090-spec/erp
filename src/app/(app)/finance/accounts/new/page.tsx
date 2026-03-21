"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import {
  accountCodeMatchesParent,
  buildParentAccountOptions,
  sanitizeAccountCodeInput,
  suggestChildAccountCode,
  type AccountListOption,
} from "@/lib/account-hierarchy";

const accountTypeOptions = [
  { label: "자산", value: "asset" },
  { label: "부채", value: "liability" },
  { label: "자본", value: "equity" },
  { label: "수익", value: "revenue" },
  { label: "비용", value: "expense" },
];

const postingAllowedOptions = [
  { label: "전기가능", value: "true" },
  { label: "집계계정", value: "false" },
];

const accountLevelOptions = [
  { label: "최상위 계정", value: "root" },
  { label: "하위 계정", value: "child" },
];

export default function AccountNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountListOption[]>([]);
  const [form, setForm] = useState({
    accountLevel: "root",
    parentAccountId: "",
    accountCode: "",
    accountName: "",
    accountType: "asset",
    postingAllowed: "false",
    description: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts");
        const json = await response.json();

        if (!cancelled && json.ok) {
          setAccounts(json.data.items ?? []);
        }
      } catch {
        if (!cancelled) {
          setAccounts([]);
        }
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const parentOptions = useMemo(() => buildParentAccountOptions(accounts), [accounts]);
  const selectedParent = parentOptions.find((option) => option.value === form.parentAccountId) ?? null;
  const selectedParentCode = selectedParent?.accountCode || "";
  const suggestedChildCode = useMemo(
    () => suggestChildAccountCode(selectedParentCode, accounts.map((account) => account.accountCode)),
    [accounts, selectedParentCode],
  );
  const normalizedAccountCode = useMemo(
    () => sanitizeAccountCodeInput(form.accountCode),
    [form.accountCode],
  );
  const hasDuplicateAccountCode = useMemo(
    () =>
      Boolean(
        normalizedAccountCode &&
          accounts.some(
            (account) => sanitizeAccountCodeInput(account.accountCode) === normalizedAccountCode,
          ),
      ),
    [accounts, normalizedAccountCode],
  );

  const update =
    (key: keyof typeof form) =>
    (value: string) => {
      setForm((prev) => {
        if (key === "accountLevel") {
          return {
            ...prev,
            accountLevel: value,
            parentAccountId: value === "child" ? prev.parentAccountId : "",
            postingAllowed:
              value === "root"
                ? "false"
                : prev.postingAllowed === "false" && prev.accountLevel === "root"
                  ? "true"
                  : prev.postingAllowed,
          };
        }

        if (key === "parentAccountId") {
          const nextParentCode =
            parentOptions.find((option) => option.value === value)?.accountCode || "";
          const nextSuggestedCode = suggestChildAccountCode(
            nextParentCode,
            accounts.map((account) => account.accountCode),
          );

          return {
            ...prev,
            parentAccountId: value,
            accountCode:
              prev.accountLevel === "child" && (!prev.accountCode || prev.accountCode === suggestedChildCode)
                ? nextSuggestedCode
                : prev.accountCode,
          };
        }

        if (key === "accountCode") {
          return {
            ...prev,
            accountCode: sanitizeAccountCodeInput(value),
          };
        }

        return {
          ...prev,
          [key]: value,
        };
      });
    };

  const handleSubmit = async () => {
    if (!form.accountCode.trim() || !form.accountName.trim() || !form.accountType) {
      pushToast({
        title: "필수 입력",
        description: "계정코드, 계정명, 계정유형을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (hasDuplicateAccountCode) {
      pushToast({
        title: "계정코드 중복",
        description: "이미 사용 중인 계정코드입니다.",
        tone: "warning",
      });
      return;
    }

    if (form.accountLevel === "child" && !selectedParentCode) {
      pushToast({
        title: "상위계정 선택",
        description: "하위 계정은 상위계정을 선택해야 합니다.",
        tone: "warning",
      });
      return;
    }

    if (
      form.accountLevel === "child" &&
      selectedParentCode &&
      !accountCodeMatchesParent(form.accountCode, selectedParentCode)
    ) {
      pushToast({
        title: "계정코드 확인",
        description: `하위 계정코드는 상위계정 ${selectedParentCode} 체계와 맞아야 합니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode: form.accountCode.trim(),
          accountName: form.accountName.trim(),
          accountType: form.accountType,
          parentAccountCode: form.accountLevel === "child" ? selectedParentCode : "",
          postingAllowed: form.postingAllowed === "true",
          description: form.description.trim(),
          status: "active",
        }),
      });
      const json = await response.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "계정과목을 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "계정과목이 등록되었습니다.",
        tone: "success",
      });
      router.push("/finance/accounts");
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
        eyebrow="Finance"
        title="계정과목 등록"
        description="차트오브어카운트에 사용할 계정을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link
              href="/finance/accounts"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || hasDuplicateAccountCode}
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
            label="계정 레벨"
            required
            type="select"
            value={form.accountLevel}
            onChange={update("accountLevel")}
            options={accountLevelOptions}
          />
          {form.accountLevel === "child" ? (
            <FormField
              label="상위계정"
              required
              type="select"
              value={form.parentAccountId}
              onChange={update("parentAccountId")}
              options={parentOptions}
            />
          ) : null}
          <FormField
            label="계정코드"
            required
            value={form.accountCode}
            onChange={update("accountCode")}
            placeholder="411100"
            inputMode="numeric"
            error={hasDuplicateAccountCode ? "이미 사용 중인 계정코드입니다." : undefined}
          />
          <FormField
            label="계정명"
            required
            value={form.accountName}
            onChange={update("accountName")}
            placeholder="Direct Material Cost"
          />
          <FormField
            label="계정유형"
            required
            type="select"
            value={form.accountType}
            onChange={update("accountType")}
            options={accountTypeOptions}
          />
          <FormField
            label="전기가능"
            type="select"
            value={form.postingAllowed}
            onChange={update("postingAllowed")}
            options={postingAllowedOptions}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <FormField
              label="설명"
              type="textarea"
              value={form.description}
              onChange={update("description")}
              placeholder="계정과목의 사용 목적과 전표 입력 기준을 기록합니다."
              rows={4}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}
