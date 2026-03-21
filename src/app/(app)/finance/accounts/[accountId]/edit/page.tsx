"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import {
  buildParentAccountOptions,
  getAccountLevelFromParent,
  type AccountListOption,
} from "@/lib/account-hierarchy";

type AccountDoc = {
  _id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountCode: string | null;
  postingAllowed: boolean;
  status: string;
  description?: string;
  usageSummary?: {
    childCount?: number;
  } | null;
};

const postingAllowedOptions = [
  { label: "전기가능", value: "true" },
  { label: "집계계정", value: "false" },
];

const accountLevelOptions = [
  { label: "최상위 계정", value: "root" },
  { label: "하위 계정", value: "child" },
];

const statusOptions = [
  { label: "활성", value: "active" },
  { label: "비활성", value: "inactive" },
];

export default function AccountEditPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<AccountDoc | null>(null);
  const [accounts, setAccounts] = useState<AccountListOption[]>([]);
  const [form, setForm] = useState({
    accountLevel: "root",
    parentAccountId: "",
    accountName: "",
    postingAllowed: "true",
    status: "active",
    description: "",
  });

  const parentOptions = useMemo(() => buildParentAccountOptions(accounts), [accounts]);
  const selectedParent = parentOptions.find((option) => option.value === form.parentAccountId) ?? null;
  const selectedParentCode = selectedParent?.accountCode || "";
  const hasChildAccounts = (doc?.usageSummary?.childCount ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [accountResponse, accountsResponse] = await Promise.all([
          fetch(`/api/accounts/${accountId}`),
          fetch("/api/accounts"),
        ]);
        const [accountJson, accountsJson] = await Promise.all([
          accountResponse.json(),
          accountsResponse.json(),
        ]);

        if (cancelled) {
          return;
        }

        if (!accountJson.ok) {
          pushToast({
            title: "계정과목 조회 실패",
            description: accountJson.message || "계정과목을 불러오지 못했습니다.",
            tone: "warning",
          });
          router.push("/finance/accounts");
          return;
        }

        const nextAccounts = (accountsJson.ok ? accountsJson.data.items : []) as AccountListOption[];
        const nextDoc = accountJson.data as AccountDoc;
        const nextParentOptions = buildParentAccountOptions(nextAccounts);
        const matchingParentOption =
          nextParentOptions.find(
            (option) => option.accountCode === (nextDoc.parentAccountCode || ""),
          ) ?? null;

        setAccounts(nextAccounts);
        setDoc(nextDoc);
        setForm({
          accountLevel: getAccountLevelFromParent(nextDoc.parentAccountCode),
          parentAccountId: matchingParentOption?.value || "",
          accountName: nextDoc.accountName || "",
          postingAllowed:
            nextDoc.postingAllowed && (nextDoc.usageSummary?.childCount ?? 0) === 0 ? "true" : "false",
          status: nextDoc.status || "active",
          description: nextDoc.description || "",
        });
      } catch {
        if (!cancelled) {
          pushToast({
            title: "계정과목 조회 실패",
            description: "네트워크 오류가 발생했습니다.",
            tone: "warning",
          });
          router.push("/finance/accounts");
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
  }, [accountId, pushToast, router]);

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
              hasChildAccounts
                ? "false"
                : value === "root"
                ? "false"
                : prev.postingAllowed === "false" && prev.accountLevel === "root"
                  ? "true"
                  : prev.postingAllowed,
          };
        }

        return {
          ...prev,
          [key]: value,
        };
      });
    };

  const handleSubmit = async () => {
    if (!doc) {
      return;
    }

    if (!form.accountName.trim()) {
      pushToast({
        title: "필수 입력",
        description: "계정명을 확인해 주세요.",
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

    setSaving(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: form.accountName.trim(),
          parentAccountCode: form.accountLevel === "child" ? selectedParentCode : "",
          postingAllowed: form.postingAllowed === "true",
          status: form.status,
          description: form.description.trim(),
        }),
      });
      const json = await response.json();

      if (!json.ok) {
        pushToast({
          title: "저장 실패",
          description: json.message || "계정과목을 수정하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "저장 완료",
        description: "계정과목이 업데이트되었습니다.",
        tone: "success",
      });
      router.push(`/finance/accounts/${doc._id}`);
    } catch {
      pushToast({
        title: "저장 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

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
        title={`${doc.accountCode} 수정`}
        description="계정과목의 계층, 설명, 전기 가능 여부, 상태를 관리합니다."
        actions={
          <>
            <Link
              href={`/finance/accounts/${accountId}`}
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
          <FormField label="계정코드" type="readonly" value={doc.accountCode} />
          <FormField label="계정유형" type="readonly" value={doc.accountType} />
          <FormField
            label="계정 레벨"
            type="select"
            value={form.accountLevel}
            onChange={update("accountLevel")}
            options={accountLevelOptions}
          />
          {form.accountLevel === "child" ? (
            <FormField
              label="상위계정"
              type="select"
              value={form.parentAccountId}
              onChange={update("parentAccountId")}
              options={parentOptions}
            />
          ) : null}
          <FormField
            label="계정명"
            required
            value={form.accountName}
            onChange={update("accountName")}
            placeholder="계정 명칭"
          />
          {hasChildAccounts ? (
            <FormField
              label="전기가능"
              type="readonly"
              value="집계계정 (하위계정 존재)"
            />
          ) : (
            <FormField
              label="전기가능"
              type="select"
              value={form.postingAllowed}
              onChange={update("postingAllowed")}
              options={postingAllowedOptions}
            />
          )}
          <FormField
            label="상태"
            type="select"
            value={form.status}
            onChange={update("status")}
            options={statusOptions}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <FormField
              label="설명"
              type="textarea"
              value={form.description}
              onChange={update("description")}
              placeholder="계정과목 사용 목적과 전표 기준을 입력합니다."
              rows={4}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}
