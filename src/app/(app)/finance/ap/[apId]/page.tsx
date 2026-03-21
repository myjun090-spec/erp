"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { canCancelApApproval, canPayAp } from "@/lib/ap-status";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

type PaymentHistoryItem = {
  paymentId: string;
  paymentDate: string;
  amount: number;
  method: string;
  note: string;
  createdAt: string;
  createdBy?: {
    displayName?: string;
    orgUnitName?: string;
  } | null;
};

type ApDoc = {
  _id: string;
  invoiceNo: string;
  vendorSnapshot?: { name?: string } | null;
  sourceSnapshot?: { refNo?: string } | null;
  journalEntrySnapshot?: { journalEntryId?: string; voucherNo?: string } | null;
  projectSnapshot?: { name?: string } | null;
  wbsSnapshot?: { name?: string } | null;
  budgetSnapshot?: { budgetCode?: string; version?: string } | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currency?: string;
  status: string;
  paymentSummary?: {
    paidAmount?: number;
    remainingAmount?: number;
    lastPaidAt?: string;
    lastPaymentMethod?: string;
    paymentCount?: number;
  } | null;
  paymentHistory?: PaymentHistoryItem[];
};

const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "info",
  "partial-paid": "warning",
  paid: "success",
  overdue: "danger",
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function ApDetailPage() {
  const params = useParams();
  const apId = String((params as Record<string, string>).apId ?? "");
  const { pushToast } = useToast();
  const [doc, setDoc] = useState<ApDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: getToday(),
    amount: "",
    paymentMethod: "bank-transfer",
    paymentNote: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ap/${apId}`);
      const json = await response.json();
      if (!json.ok) {
        setError(json.message || "AP를 불러오지 못했습니다.");
        return;
      }
      setDoc(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const paymentSummary = doc?.paymentSummary ?? null;
  const remainingAmount = Number(paymentSummary?.remainingAmount || 0);
  const paidAmount = Number(paymentSummary?.paidAmount || 0);
  const paymentHistory = doc?.paymentHistory ?? [];
  const enteredPaymentAmount = parseFormattedInteger(paymentForm.amount);
  const isPaymentAmountExceeded = enteredPaymentAmount > remainingAmount;

  const paymentMethodLabel = useMemo(() => {
    return {
      "bank-transfer": "계좌이체",
      card: "법인카드",
      cash: "현금",
      offset: "상계",
    } as const;
  }, []);

  const openPaymentDrawer = () => {
    if (!doc) {
      return;
    }
    setPaymentForm({
      paymentDate: getToday(),
      amount: formatIntegerInput(remainingAmount),
      paymentMethod: "bank-transfer",
      paymentNote: "",
    });
    setPaymentDrawerOpen(true);
  };

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

  const submitPayment = async () => {
    if (!doc) {
      return;
    }

    if (!paymentForm.paymentDate || enteredPaymentAmount <= 0) {
      pushToast({
        title: "필수 입력",
        description: "지급일과 지급금액을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (isPaymentAmountExceeded) {
      pushToast({
        title: "지급 금액 초과",
        description: `남은 지급 금액 ${remainingAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    setPaymentSaving(true);
    try {
      const response = await fetch(`/api/ap/${doc._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDate: paymentForm.paymentDate,
          amount: enteredPaymentAmount,
          paymentMethod: paymentForm.paymentMethod,
          paymentNote: paymentForm.paymentNote,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "지급 등록 실패",
          description: json.message || "지급 이력을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setPaymentDrawerOpen(false);
      setDoc(json.data);
      pushToast({
        title: "지급 등록 완료",
        description: "지급 이력이 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "지급 등록 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setPaymentSaving(false);
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
          {error || "AP를 찾을 수 없습니다."}
        </h2>
        <Link href="/finance/ap" className="mt-4 text-sm text-[color:var(--primary)]">
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
        description="매입전표 상세와 지급 현황을 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: doc.status || "-", tone: statusTone[doc.status] || "default" },
        ]}
        actions={
          <>
            <Link
              href="/finance/ap"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            {doc.journalEntrySnapshot?.journalEntryId ? (
              <Link
                href={`/finance/journal-entries/${doc.journalEntrySnapshot.journalEntryId}`}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                연계 전표
              </Link>
            ) : null}
            {doc.status === "pending" ? (
              <PermissionButton
                permission="ap.approve"
                type="button"
                onClick={() => void runBulkAction("approve-ap", "승인")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-60"
              >
                승인
              </PermissionButton>
            ) : null}
            {canCancelApApproval(doc.status) ? (
              <PermissionButton
                permission="ap.cancel-approval"
                type="button"
                onClick={() => void runBulkAction("cancel-ap-approval", "승인 취소")}
                disabled={submittingAction}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
              >
                승인 취소
              </PermissionButton>
            ) : null}
            {canPayAp(doc.status) ? (
              <PermissionButton
                permission="ap.pay"
                type="button"
                onClick={openPaymentDrawer}
                disabled={submittingAction || remainingAmount <= 0}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                지급 등록
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
            지급액
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--info)]">
            ₩ {paidAmount.toLocaleString()}
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
          <DetailField label="송장번호" value={doc.invoiceNo} />
          <DetailField label="공급업체" value={doc.vendorSnapshot?.name || "-"} />
          <DetailField label="상태" value={<StatusBadge label={doc.status} tone={statusTone[doc.status] || "default"} />} />
          <DetailField label="참조 발주" value={doc.sourceSnapshot?.refNo || "-"} />
          <DetailField label="연계 전표" value={doc.journalEntrySnapshot?.voucherNo || "-"} />
          <DetailField label="프로젝트" value={doc.projectSnapshot?.name || "-"} />
          <DetailField label="WBS" value={doc.wbsSnapshot?.name || "-"} />
          <DetailField label="예산 버전" value={doc.budgetSnapshot?.version || "-"} />
          <DetailField label="예산 코드" value={doc.budgetSnapshot?.budgetCode || "-"} />
          <DetailField label="송장일" value={doc.invoiceDate || "-"} />
          <DetailField label="만기일" value={doc.dueDate || "-"} />
          <DetailField label="마지막 지급일" value={paymentSummary?.lastPaidAt || "-"} />
        </dl>
      </Panel>

      <Panel className="mt-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text)]">지급 이력</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              지급 등록 시 부분지급은 `partial-paid`, 잔액 0원은 `paid`로 자동 전환됩니다.
            </p>
          </div>
          <div className="text-xs font-medium text-[color:var(--text-muted)]">
            총 {paymentHistory.length}건
          </div>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--text-muted)]">
            등록된 지급 이력이 없습니다.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  <th className="px-3 py-3">지급일</th>
                  <th className="px-3 py-3">지급수단</th>
                  <th className="px-3 py-3 text-right">금액</th>
                  <th className="px-3 py-3">등록자</th>
                  <th className="px-3 py-3">메모</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((item) => (
                  <tr key={item.paymentId} className="border-b border-[color:var(--border)] last:border-b-0">
                    <td className="px-3 py-3">{item.paymentDate}</td>
                    <td className="px-3 py-3">{paymentMethodLabel[item.method as keyof typeof paymentMethodLabel] || item.method}</td>
                    <td className="px-3 py-3 text-right font-mono">₩ {Number(item.amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {item.createdBy?.displayName || "-"}
                      {item.createdBy?.orgUnitName ? (
                        <div className="text-xs text-[color:var(--text-muted)]">{item.createdBy.orgUnitName}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--text-muted)]">{item.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Drawer
        open={paymentDrawerOpen}
        onClose={() => setPaymentDrawerOpen(false)}
        eyebrow="Finance"
        title="지급 등록"
        description="AP 잔액 범위 안에서 지급 이력을 등록합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => setPaymentDrawerOpen(false)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void submitPayment()}
              disabled={paymentSaving || isPaymentAmountExceeded || enteredPaymentAmount <= 0}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {paymentSaving ? "저장 중..." : "지급 등록"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="지급일"
            required
            type="date"
            value={paymentForm.paymentDate}
            onChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentDate: value }))}
          />
          <FormField
            label="지급수단"
            required
            type="select"
            value={paymentForm.paymentMethod}
            onChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentMethod: value }))}
            options={[
              { label: "계좌이체", value: "bank-transfer" },
              { label: "법인카드", value: "card" },
              { label: "현금", value: "cash" },
              { label: "상계", value: "offset" },
            ]}
          />
          <FormField
            label="지급금액"
            required
            type="text"
            inputMode="numeric"
            value={paymentForm.amount}
            onChange={(value) =>
              setPaymentForm((prev) => ({ ...prev, amount: formatIntegerInput(value) }))
            }
            placeholder="0"
          />
          <FormField
            label="메모"
            value={paymentForm.paymentNote}
            onChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentNote: value }))}
            placeholder="지급 메모"
          />
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              현재 지급액
            </div>
            <div className="mt-1 font-mono text-[color:var(--text)]">₩ {paidAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              입력 금액
            </div>
            <div className="mt-1 font-mono text-[color:var(--text)]">₩ {enteredPaymentAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              처리 후 잔액
            </div>
            <div className="mt-1 font-mono text-[color:var(--warning)]">
              ₩ {Math.max(remainingAmount - enteredPaymentAmount, 0).toLocaleString()}
            </div>
          </div>
        </div>

        {isPaymentAmountExceeded ? (
          <div className="mt-4 rounded-2xl border border-[rgba(201,55,44,0.16)] bg-[rgba(255,239,239,0.76)] px-4 py-4 text-sm text-[color:var(--danger)]">
            남은 지급 금액 {remainingAmount.toLocaleString()}원을 초과할 수 없습니다.
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
