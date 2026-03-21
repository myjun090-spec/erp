"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { DetailField } from "@/components/ui/detail-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { getJournalEntryOriginLabel } from "@/lib/journal-entry-origin";
import {
  canCancelJournalEntrySubmit,
  canEditJournalEntry,
  canPostJournalEntry,
  canReverseJournalEntry,
  canSubmitJournalEntry,
  getJournalEntryStatusTone,
} from "@/lib/journal-entry-status";

type JournalEntryDoc = {
  _id: string;
  voucherNo: string;
  journalType: string;
  originType: string;
  status: string;
  journalDate: string;
  postedAt?: string;
  reversedAt?: string;
  description?: string;
  sourceSnapshot?: {
    sourceType?: string;
    sourceId?: string;
    refNo?: string;
  } | null;
  customerSnapshot?: { partyId?: string; code?: string; name?: string } | null;
  projectSnapshot?: { name?: string } | null;
  contractSnapshot?: { contractId?: string; contractNo?: string; title?: string } | null;
  wbsSnapshot?: { name?: string } | null;
  budgetSnapshot?: { budgetCode?: string; version?: string } | null;
  accountingUnitSnapshot?: { code?: string; name?: string } | null;
  accountSnapshot?: { accountCode?: string; accountName?: string } | null;
  totalDebit?: number;
  totalCredit?: number;
};

function buildSourceLink(doc: JournalEntryDoc) {
  const sourceType = String(doc.sourceSnapshot?.sourceType || "");
  const sourceId = String(doc.sourceSnapshot?.sourceId || "");
  if (!sourceId) {
    return null;
  }

  switch (sourceType) {
    case "ap_invoice":
      return `/finance/ap/${sourceId}`;
    case "ar_invoice":
      return `/finance/ar/${sourceId}`;
    case "purchase_order":
      return `/supply-chain/purchase-orders/${sourceId}`;
    default:
      return null;
  }
}

export default function JournalEntryDetailPage() {
  const params = useParams();
  const entryId = String((params as Record<string, string>).entryId ?? "");
  const { pushToast } = useToast();
  const [doc, setDoc] = useState<JournalEntryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/journal-entries/${entryId}`);
      const json = await response.json();
      if (!json.ok) {
        setError(json.message || "전표를 불러오지 못했습니다.");
        return;
      }
      setDoc(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const runBulkAction = async (action: string, label: string) => {
    if (!doc) {
      return;
    }

    setSubmittingAction(true);
    try {
      const response = await fetch("/api/finance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds: [doc._id] }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: `${label} 실패`,
          description: json.message || `${label} 처리에 실패했습니다.`,
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: label,
        description: "전표 상태가 업데이트되었습니다.",
        tone: "success",
      });
      await fetchData();
    } catch {
      pushToast({
        title: `${label} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">
        로딩 중...
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-[color:var(--danger)]">
          {error || "전표를 찾을 수 없습니다."}
        </h2>
        <Link href="/finance/journal-entries" className="mt-4 text-sm text-[color:var(--primary)]">
          목록으로
        </Link>
      </div>
    );
  }

  const sourceLink = buildSourceLink(doc);
  const customerLink = doc.customerSnapshot?.partyId
    ? `/business-development/parties/${doc.customerSnapshot.partyId}`
    : null;
  const contractLink = doc.contractSnapshot?.contractId
    ? `/business-development/contracts/${doc.contractSnapshot.contractId}`
    : null;
  const contractLabel =
    doc.contractSnapshot?.contractNo || doc.contractSnapshot?.title
      ? `${doc.contractSnapshot?.contractNo || "-"} · ${doc.contractSnapshot?.title || "-"}`
      : "-";
  const totalDebit = Number(doc.totalDebit || 0);
  const totalCredit = Number(doc.totalCredit || 0);
  const isBalanced = totalDebit === totalCredit;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={doc.voucherNo}
        description="전표 상세와 확정/역분개 상태를 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          {
            label: doc.status || "-",
            tone: getJournalEntryStatusTone(doc.status),
          },
        ]}
        actions={
          <>
            <Link
              href="/finance/journal-entries"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            {sourceLink ? (
              <Link
                href={sourceLink}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                원천 문서
              </Link>
            ) : null}
            {canEditJournalEntry(doc.status) ? (
              <PermissionLink
                permission="journal-entry.update"
                href={`/finance/journal-entries/${doc._id}/edit`}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]"
              >
                수정
              </PermissionLink>
            ) : null}
            {canSubmitJournalEntry(doc.status) ? (
              <PermissionButton
                permission="journal-entry.submit"
                type="button"
                onClick={() => void runBulkAction("submit-journal-entry", "전표 제출")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-60"
              >
                제출
              </PermissionButton>
            ) : null}
            {canCancelJournalEntrySubmit(doc.status) ? (
              <PermissionButton
                permission="journal-entry.submit"
                type="button"
                onClick={() => void runBulkAction("cancel-journal-submit", "제출 취소")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
              >
                제출 취소
              </PermissionButton>
            ) : null}
            {canPostJournalEntry(doc.status) ? (
              <PermissionButton
                permission="journal-entry.post"
                type="button"
                onClick={() => void runBulkAction("post", "전표 확정")}
                disabled={submittingAction}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                확정
              </PermissionButton>
            ) : null}
            {canReverseJournalEntry(doc.status) ? (
              <PermissionButton
                permission="journal-entry.reverse"
                type="button"
                onClick={() => void runBulkAction("reverse", "역분개")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                역분개
              </PermissionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            차변 합계
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--text)]">
            ₩ {totalDebit.toLocaleString()}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            대변 합계
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--text)]">
            ₩ {totalCredit.toLocaleString()}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            균형 상태
          </div>
          <div className="mt-2">
            <StatusBadge
              label={isBalanced ? "balanced" : "unbalanced"}
              tone={isBalanced ? "success" : "danger"}
            />
          </div>
        </Panel>
      </div>

      {!doc.accountingUnitSnapshot?.name || !doc.accountSnapshot?.accountCode ? (
        <Panel className="mt-4 border border-[rgba(161,92,7,0.18)] bg-[rgba(255,243,214,0.68)] p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--warning)]">
            확정 전 확인
          </div>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            회계단위와 계정과목이 지정된 전표만 확정할 수 있습니다. 초안 상태라면 먼저 수정에서 값을 보완해 주세요.
          </p>
        </Panel>
      ) : null}

      <Panel className="mt-4 p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">상세정보</h3>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="전표번호" value={doc.voucherNo} />
          <DetailField label="유형" value={doc.journalType || "-"} />
          <DetailField label="원천" value={getJournalEntryOriginLabel(doc.originType)} />
          <DetailField
            label="참조 문서"
            value={
              sourceLink ? (
                <Link href={sourceLink} className="text-[color:var(--primary)] hover:underline">
                  {doc.sourceSnapshot?.refNo || "-"}
                </Link>
              ) : (
                doc.sourceSnapshot?.refNo || "-"
              )
            }
          />
          <DetailField label="전표일" value={doc.journalDate || "-"} />
          <DetailField
            label="상태"
            value={
              <StatusBadge
                label={doc.status || "-"}
                tone={getJournalEntryStatusTone(doc.status)}
              />
            }
          />
          <DetailField label="프로젝트" value={doc.projectSnapshot?.name || "-"} />
          <DetailField
            label="고객"
            value={
              customerLink ? (
                <Link href={customerLink} className="text-[color:var(--primary)] hover:underline">
                  {doc.customerSnapshot?.name || doc.customerSnapshot?.code || "-"}
                </Link>
              ) : (
                doc.customerSnapshot?.name || doc.customerSnapshot?.code || "-"
              )
            }
          />
          <DetailField
            label="계약"
            value={
              contractLink ? (
                <Link href={contractLink} className="text-[color:var(--primary)] hover:underline">
                  {contractLabel}
                </Link>
              ) : (
                contractLabel
              )
            }
          />
          <DetailField label="WBS" value={doc.wbsSnapshot?.name || "-"} />
          <DetailField
            label="예산 버전"
            value={
              doc.budgetSnapshot
                ? `${doc.budgetSnapshot.budgetCode || "-"} · ${doc.budgetSnapshot.version || "-"}`
                : "-"
            }
          />
          <DetailField
            label="회계단위"
            value={
              doc.accountingUnitSnapshot
                ? `${doc.accountingUnitSnapshot.code || "-"} · ${doc.accountingUnitSnapshot.name || "-"}`
                : "-"
            }
          />
          <DetailField
            label="계정과목"
            value={
              doc.accountSnapshot
                ? `${doc.accountSnapshot.accountCode || "-"} · ${doc.accountSnapshot.accountName || "-"}`
                : "-"
            }
          />
          <DetailField label="확정일" value={doc.postedAt || "-"} />
          <DetailField label="역분개일" value={doc.reversedAt || "-"} />
          <DetailField label="적요" value={doc.description || "-"} className="md:col-span-2 lg:col-span-3" />
        </dl>
      </Panel>
    </>
  );
}
