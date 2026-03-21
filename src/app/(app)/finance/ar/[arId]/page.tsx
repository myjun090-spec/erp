"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import {
  canCancelArCollection,
  canCancelArIssue,
  canCollectAr,
  canIssueAr,
} from "@/lib/ar-status";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

type CollectionHistoryItem = {
  collectionId: string;
  collectionDate: string;
  amount: number;
  method: string;
  note: string;
  createdAt: string;
  createdBy?: {
    displayName?: string;
    orgUnitName?: string;
  } | null;
  journalEntrySnapshot?: {
    journalEntryId?: string;
    voucherNo?: string;
    status?: string;
  } | null;
};

type ArDoc = {
  _id: string;
  invoiceNo: string;
  customerSnapshot?: { name?: string } | null;
  projectSnapshot?: { name?: string } | null;
  contractSnapshot?: { contractNo?: string; title?: string } | null;
  contractBillingSummary?: {
    contractAmount?: number;
    billedAmount?: number;
    remainingBillableAmount?: number;
  } | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currency?: string;
  status: string;
  collectionSummary?: {
    receivedAmount?: number;
    remainingAmount?: number;
    lastReceivedAt?: string;
    lastCollectionMethod?: string;
    collectionCount?: number;
  } | null;
  collectionHistory?: CollectionHistoryItem[];
  changeHistory?: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    occurredAt: string;
    reason?: string;
    actorSnapshot?: {
      displayName?: string;
      orgUnitName?: string;
    } | null;
  }>;
  issueJournalEntrySnapshot?: {
    journalEntryId?: string;
    voucherNo?: string;
    status?: string;
  } | null;
};

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  draft: "default",
  issued: "info",
  "partial-received": "warning",
  received: "success",
  overdue: "danger",
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function ArDetailPage() {
  const params = useParams();
  const arId = String((params as Record<string, string>).arId ?? "");
  const { pushToast } = useToast();
  const [doc, setDoc] = useState<ArDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [collectionDrawerOpen, setCollectionDrawerOpen] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [cancelIssueDrawerOpen, setCancelIssueDrawerOpen] = useState(false);
  const [cancelCollectionTarget, setCancelCollectionTarget] = useState<CollectionHistoryItem | null>(
    null,
  );
  const [cancelIssueReason, setCancelIssueReason] = useState("");
  const [cancelCollectionReason, setCancelCollectionReason] = useState("");
  const [collectionForm, setCollectionForm] = useState({
    collectionDate: getToday(),
    amount: "",
    collectionMethod: "bank-transfer",
    collectionNote: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ar/${arId}`);
      const json = await response.json();
      if (!json.ok) {
        setError(json.message || "AR을 불러오지 못했습니다.");
        return;
      }
      setDoc(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [arId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const collectionSummary = doc?.collectionSummary ?? null;
  const remainingAmount = Number(collectionSummary?.remainingAmount || 0);
  const receivedAmount = Number(collectionSummary?.receivedAmount || 0);
  const contractRemainingBillableAmount = Number(
    doc?.contractBillingSummary?.remainingBillableAmount || 0,
  );
  const collectionHistory = doc?.collectionHistory ?? [];
  const changeHistory = doc?.changeHistory ?? [];
  const latestCollectionId = collectionHistory[collectionHistory.length - 1]?.collectionId || "";
  const enteredCollectionAmount = parseFormattedInteger(collectionForm.amount);
  const isCollectionAmountExceeded = enteredCollectionAmount > remainingAmount;

  const collectionMethodLabel = useMemo(() => {
    return {
      "bank-transfer": "계좌이체",
      card: "카드결제",
      cash: "현금",
      offset: "상계",
    } as const;
  }, []);

  const openCollectionDrawer = () => {
    if (!doc) return;
    setCollectionForm({
      collectionDate: getToday(),
      amount: formatIntegerInput(remainingAmount),
      collectionMethod: "bank-transfer",
      collectionNote: "",
    });
    setCollectionDrawerOpen(true);
  };

  const runBulkAction = async (action: string, label: string, reason?: string) => {
    if (!doc) return;
    setSubmittingAction(true);
    try {
      const response = await fetch("/api/finance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds: [doc._id], reason }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "처리 실패",
          description: json.message || `${label}에 실패했습니다.`,
          tone: "warning",
        });
        return;
      }
      pushToast({
        title: label,
        description: "상태가 업데이트되었습니다.",
        tone: "success",
      });
      await fetchData();
    } catch {
      pushToast({
        title: "처리 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const submitCollection = async () => {
    if (!doc) return;

    if (!collectionForm.collectionDate || enteredCollectionAmount <= 0) {
      pushToast({
        title: "필수 입력",
        description: "수금일과 수금금액을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (isCollectionAmountExceeded) {
      pushToast({
        title: "수금 금액 초과",
        description: `남은 수금 가능 금액 ${remainingAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    setCollectionSaving(true);
    try {
      const response = await fetch(`/api/ar/${doc._id}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionDate: collectionForm.collectionDate,
          amount: enteredCollectionAmount,
          collectionMethod: collectionForm.collectionMethod,
          collectionNote: collectionForm.collectionNote,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "수금 등록 실패",
          description: json.message || "수금 이력을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setCollectionDrawerOpen(false);
      setDoc(json.data);
      pushToast({
        title: "수금 등록 완료",
        description: "수금 이력이 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "수금 등록 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setCollectionSaving(false);
    }
  };

  const cancelCollection = async (target: CollectionHistoryItem) => {
    if (!doc) {
      return;
    }

    if (!cancelCollectionReason.trim()) {
      pushToast({
        title: "필수 입력",
        description: "수금 취소 사유를 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSubmittingAction(true);
    try {
      const response = await fetch(
        `/api/ar/${doc._id}/collections/${target.collectionId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelCollectionReason }),
        },
      );
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "수금 취소 실패",
          description: json.message || "수금 취소를 처리하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setCancelCollectionTarget(null);
      setCancelCollectionReason("");
      setDoc(json.data);
      pushToast({
        title: "수금 취소 완료",
        description: "수금 이력과 연계 전표 초안이 정리되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "수금 취소 실패",
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
          {error || "AR을 찾을 수 없습니다."}
        </h2>
        <Link href="/finance/ar" className="mt-4 text-sm text-[color:var(--primary)]">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={doc.invoiceNo}
        description="매출전표 상세와 수금 현황을 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: doc.status || "-", tone: statusTone[doc.status] || "default" },
        ]}
        actions={
          <>
            <Link
              href="/finance/ar"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            {doc.issueJournalEntrySnapshot?.journalEntryId ? (
              <Link
                href={`/finance/journal-entries/${doc.issueJournalEntrySnapshot.journalEntryId}`}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                발행 전표
              </Link>
            ) : null}
            {canIssueAr(doc.status) ? (
              <PermissionButton
                permission="ar.issue"
                type="button"
                onClick={() => void runBulkAction("issue", "발행")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-60"
              >
                발행
              </PermissionButton>
            ) : null}
            {canCancelArIssue(doc.status, receivedAmount) ? (
              <PermissionButton
                permission="ar.cancel-issue"
                type="button"
                onClick={() => {
                  setCancelIssueReason("");
                  setCancelIssueDrawerOpen(true);
                }}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
              >
                발행 취소
              </PermissionButton>
            ) : null}
            {canCollectAr(doc.status) ? (
              <PermissionButton
                permission="ar.collect"
                type="button"
                onClick={openCollectionDrawer}
                disabled={submittingAction || remainingAmount <= 0}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                수금 등록
              </PermissionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            총액
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--text)]">
            ₩ {Number(doc.totalAmount || 0).toLocaleString()}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            수금액
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--info)]">
            ₩ {receivedAmount.toLocaleString()}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            잔액
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--warning)]">
            ₩ {remainingAmount.toLocaleString()}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">상세정보</h3>
        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DetailField label="청구번호" value={doc.invoiceNo} />
          <DetailField label="고객" value={doc.customerSnapshot?.name || "-"} />
          <DetailField label="상태" value={<StatusBadge label={doc.status} tone={statusTone[doc.status] || "default"} />} />
          <DetailField label="프로젝트" value={doc.projectSnapshot?.name || "-"} />
          <DetailField
            label="계약"
            value={
              doc.contractSnapshot?.contractNo || doc.contractSnapshot?.title
                ? `${doc.contractSnapshot?.contractNo || "-"} · ${doc.contractSnapshot?.title || "-"}`
                : "-"
            }
          />
          <DetailField label="청구일" value={doc.invoiceDate || "-"} />
          <DetailField label="만기일" value={doc.dueDate || "-"} />
          <DetailField label="마지막 수금일" value={collectionSummary?.lastReceivedAt || "-"} />
          <DetailField
            label="남은 청구 가능 금액"
            value={`₩ ${Number(doc.contractBillingSummary?.remainingBillableAmount || 0).toLocaleString()}`}
          />
          <DetailField
            label="발행 전표"
            value={
              doc.issueJournalEntrySnapshot?.journalEntryId ? (
                <Link
                  href={`/finance/journal-entries/${doc.issueJournalEntrySnapshot.journalEntryId}`}
                  className="text-[color:var(--primary)] hover:underline"
                >
                  {doc.issueJournalEntrySnapshot.voucherNo || "-"}
                </Link>
              ) : (
                "-"
              )
            }
          />
        </dl>
      </Panel>

      <Panel className="mt-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text)]">수금 이력</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              수금 등록 시 일부 금액이면 `partial-received`, 잔액 0원이면 `received`로 전환됩니다. 수금 취소는 최신 이력만 가능하며 연계 전표가 draft 상태여야 합니다.
            </p>
          </div>
          <div className="text-xs font-medium text-[color:var(--text-muted)]">
            총 {collectionHistory.length}건
          </div>
        </div>

        {collectionHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--text-muted)]">
            등록된 수금 이력이 없습니다.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  <th className="px-3 py-3">수금일</th>
                  <th className="px-3 py-3">수금수단</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3">연계 전표</th>
                  <th className="px-3 py-3">등록자</th>
                  <th className="px-3 py-3">메모</th>
                  <th className="px-3 py-3 text-right">작업</th>
                </tr>
              </thead>
              <tbody>
                {collectionHistory.map((item) => (
                  <tr key={item.collectionId} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-3 py-3">{item.collectionDate}</td>
                    <td className="px-3 py-3">{collectionMethodLabel[item.method as keyof typeof collectionMethodLabel] || item.method}</td>
                    <td className="px-3 py-3 text-right font-mono">₩ {Number(item.amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {item.journalEntrySnapshot?.journalEntryId ? (
                        <Link
                          href={`/finance/journal-entries/${item.journalEntrySnapshot.journalEntryId}`}
                          className="font-mono text-[color:var(--primary)] hover:underline"
                        >
                          {item.journalEntrySnapshot.voucherNo || "-"}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {item.createdBy?.displayName || "-"}
                      {item.createdBy?.orgUnitName ? (
                        <div className="text-xs text-[color:var(--text-muted)]">{item.createdBy.orgUnitName}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--text-muted)]">{item.note || "-"}</td>
                    <td className="px-3 py-3 text-right">
                      {item.collectionId === latestCollectionId &&
                      canCancelArCollection(doc.status, collectionHistory.length) ? (
                        <PermissionButton
                          permission="ar.cancel-collection"
                          type="button"
                          onClick={() => {
                            setCancelCollectionReason("");
                            setCancelCollectionTarget(item);
                          }}
                          disabled={submittingAction}
                          className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
                        >
                          수금 취소
                        </PermissionButton>
                      ) : (
                        <span className="text-xs text-[color:var(--text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text)]">이력</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              발행, 수금, 취소 이력이 순서대로 기록됩니다.
            </p>
          </div>
          <div className="text-xs font-medium text-[color:var(--text-muted)]">
            총 {changeHistory.length}건
          </div>
        </div>

        {changeHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--text-muted)]">
            기록된 이력이 없습니다.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {changeHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--text)]">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {item.occurredAt}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[color:var(--text-muted)]">
                    <div>{item.actorSnapshot?.displayName || "-"}</div>
                    {item.actorSnapshot?.orgUnitName ? <div>{item.actorSnapshot.orgUnitName}</div> : null}
                  </div>
                </div>
                <div className="mt-3 text-sm text-[color:var(--text-muted)]">{item.description}</div>
                {item.reason ? (
                  <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--text)]">
                    취소 사유: {item.reason}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Drawer
        open={collectionDrawerOpen}
        onClose={() => setCollectionDrawerOpen(false)}
        eyebrow="Finance"
        title="수금 등록"
        description="AR 잔액 범위 안에서 수금 이력을 등록합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCollectionDrawerOpen(false)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void submitCollection()}
              disabled={collectionSaving || isCollectionAmountExceeded || enteredCollectionAmount <= 0}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {collectionSaving ? "저장 중..." : "수금 등록"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="수금일"
            required
            type="date"
            value={collectionForm.collectionDate}
            onChange={(value) => setCollectionForm((prev) => ({ ...prev, collectionDate: value }))}
          />
          <FormField
            label="수금수단"
            required
            type="select"
            value={collectionForm.collectionMethod}
            onChange={(value) => setCollectionForm((prev) => ({ ...prev, collectionMethod: value }))}
            options={[
              { label: "계좌이체", value: "bank-transfer" },
              { label: "카드결제", value: "card" },
              { label: "현금", value: "cash" },
              { label: "상계", value: "offset" },
            ]}
          />
          <FormField
            label="수금금액"
            required
            type="text"
            inputMode="numeric"
            value={collectionForm.amount}
            onChange={(value) =>
              setCollectionForm((prev) => ({ ...prev, amount: formatIntegerInput(value) }))
            }
            placeholder="0"
          />
          <FormField
            label="메모"
            value={collectionForm.collectionNote}
            onChange={(value) => setCollectionForm((prev) => ({ ...prev, collectionNote: value }))}
            placeholder="수금 메모"
          />
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              현재 수금액
            </div>
            <div className="mt-1 font-mono text-[color:var(--text)]">₩ {receivedAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              입력 금액
            </div>
            <div className="mt-1 font-mono text-[color:var(--text)]">₩ {enteredCollectionAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              처리 후 잔액
            </div>
            <div className="mt-1 font-mono text-[color:var(--warning)]">
              ₩ {Math.max(remainingAmount - enteredCollectionAmount, 0).toLocaleString()}
            </div>
          </div>
        </div>

        {isCollectionAmountExceeded ? (
          <div className="mt-4 rounded-2xl border border-[rgba(201,55,44,0.16)] bg-[rgba(255,239,239,0.76)] px-4 py-4 text-sm text-[color:var(--danger)]">
            남은 수금 가능 금액 {remainingAmount.toLocaleString()}원을 초과할 수 없습니다.
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={cancelIssueDrawerOpen}
        onClose={() => setCancelIssueDrawerOpen(false)}
        eyebrow="Finance"
        title="AR 발행 취소"
        description={`발행 취소 시 현재 청구금액 ₩ ${Number(doc.totalAmount || 0).toLocaleString()} 만큼 계약의 남은 청구 가능 금액이 복원됩니다. 연계 발행 전표가 draft 상태이면 함께 삭제됩니다. 취소 후 예상 남은 청구 가능 금액은 ₩ ${(contractRemainingBillableAmount + Number(doc.totalAmount || 0)).toLocaleString()} 입니다.`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelIssueDrawerOpen(false)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                if (!cancelIssueReason.trim()) {
                  pushToast({
                    title: "필수 입력",
                    description: "발행 취소 사유를 입력해 주세요.",
                    tone: "warning",
                  });
                  return;
                }
                setCancelIssueDrawerOpen(false);
                void runBulkAction("cancel-issue", "발행 취소", cancelIssueReason);
              }}
              disabled={submittingAction}
              className="rounded-full border border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
            >
              발행 취소
            </button>
          </>
        }
      >
        <FormField
          label="취소 사유"
          required
          type="textarea"
          rows={4}
          value={cancelIssueReason}
          onChange={setCancelIssueReason}
          placeholder="발행 취소 사유를 입력해 주세요."
        />
      </Drawer>

      <Drawer
        open={Boolean(cancelCollectionTarget)}
        onClose={() => setCancelCollectionTarget(null)}
        eyebrow="Finance"
        title="수금 취소"
        description={
          cancelCollectionTarget
            ? `수금금액 ₩ ${Number(cancelCollectionTarget.amount || 0).toLocaleString()}이 취소되고, 연결된 수금 전표가 draft 상태이면 함께 삭제됩니다. 취소 후 예상 잔액은 ₩ ${(remainingAmount + Number(cancelCollectionTarget.amount || 0)).toLocaleString()} 입니다.`
            : ""
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelCollectionTarget(null)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                const target = cancelCollectionTarget;
                if (target) {
                  void cancelCollection(target);
                }
              }}
              disabled={submittingAction}
              className="rounded-full border border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
            >
              수금 취소
            </button>
          </>
        }
      >
        <FormField
          label="취소 사유"
          required
          type="textarea"
          rows={4}
          value={cancelCollectionReason}
          onChange={setCancelCollectionReason}
          placeholder="수금 취소 사유를 입력해 주세요."
        />
      </Drawer>
    </>
  );
}
