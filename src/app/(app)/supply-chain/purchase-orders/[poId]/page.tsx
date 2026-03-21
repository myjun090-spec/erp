"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DetailField } from "@/components/ui/detail-field";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatIntegerDisplay,
  formatIntegerInput,
  parseFormattedInteger,
} from "@/lib/number-input";
import {
  canApprovePurchaseOrder,
  canCancelPurchaseOrderApproval,
  canCreateApFromPurchaseOrder,
  canEditPurchaseOrder,
  canReceivePurchaseOrder,
  canRejectPurchaseOrder,
  canSubmitPurchaseOrder,
  getPurchaseOrderStatusTone,
} from "@/lib/purchase-order-status";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

type ReceiptDraft = {
  lineNo: number;
  quantity: string;
};

type SiteOption = {
  siteId: string;
  code: string;
  name: string;
};

type ReceiptHistoryItem = {
  receiptNo: string;
  transactionDate: string;
  storageLocation: string;
  status: string;
  cancelReason?: string;
  canceledAt?: string;
  siteSnapshot?: {
    code?: string;
    name?: string;
  } | null;
  lineItems?: {
    lineNo?: number;
    quantity?: number;
    uom?: string;
    materialDescription?: string;
  }[];
};

const actionClassNames = {
  submit:
    "rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]",
  approve:
    "rounded-full border border-[color:var(--success)] bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white",
  receive:
    "rounded-full border border-[color:var(--warning)] bg-[rgba(255,243,214,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--warning)]",
  reject:
    "rounded-full border border-[color:var(--danger)] bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white",
  "cancel-approval":
    "rounded-full border border-[color:var(--warning)] bg-[rgba(255,243,214,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--warning)]",
} as const;

const actionConfigMap = {
  submit: {
    label: "제출",
    confirmTitle: "이 발주를 제출할까요?",
    confirmDescription: "제출 후 승인 또는 반려 단계로 이동할 수 있습니다.",
    tone: "info" as const,
  },
  approve: {
    label: "승인",
    confirmTitle: "이 발주를 승인할까요?",
    confirmDescription: "승인되면 실행예산 약정 금액에 반영됩니다.",
    tone: "success" as const,
  },
  reject: {
    label: "반려",
    confirmTitle: "이 발주를 반려할까요?",
    confirmDescription: "반려하면 제출 상태에서 제외되고 약정 반영도 하지 않습니다.",
    tone: "danger" as const,
  },
  "cancel-approval": {
    label: "승인 취소",
    confirmTitle: "이 발주의 승인을 취소할까요?",
    confirmDescription: "상태가 제출로 돌아가고 약정 반영 금액도 함께 되돌립니다.",
    tone: "warning" as const,
  },
} as const;

export default function PODetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] =
    useState<keyof typeof actionConfigMap | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([]);
  const [receiptSiteId, setReceiptSiteId] = useState("");
  const [receiptStorageLocation, setReceiptStorageLocation] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [pendingReceiptCancelNo, setPendingReceiptCancelNo] = useState<string | null>(null);
  const [receiptCancelReason, setReceiptCancelReason] = useState("");
  const { pushToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const json = await res.json();
      if (json.ok) {
        setDoc(json.data);
        return;
      }
      setError(json.message);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const receiptRows = useMemo(() => {
    const lines = Array.isArray(doc?.lines) ? doc.lines : [];
    return lines.map((line: Doc, index: number) => {
      const lineNo =
        typeof line.lineNo === "number" && line.lineNo > 0 ? line.lineNo : index + 1;
      const orderedQuantity =
        typeof line.quantity === "number" ? line.quantity : Number(line.quantity || 0);
      const receivedQuantity =
        typeof line.receivedQuantity === "number"
          ? line.receivedQuantity
          : Number(line.receivedQuantity || 0);
      const remainingQuantity = Math.max(orderedQuantity - receivedQuantity, 0);
      const draft = receiptDrafts.find((item) => item.lineNo === lineNo);

      return {
        lineNo,
        materialName:
          line.materialSnapshot?.description || line.description || `라인 ${index + 1}`,
        orderedQuantity,
        receivedQuantity,
        remainingQuantity,
        currentReceiptQuantity: parseFormattedInteger(draft?.quantity || "0"),
      };
    });
  }, [doc?.lines, receiptDrafts]);

  useEffect(() => {
    setReceiptDrafts(
      receiptRows.map((row) => ({
        lineNo: row.lineNo,
        quantity: "",
      })),
    );
  }, [doc?.lines]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasReceivableLines = receiptRows.some((row) => row.remainingQuantity > 0);
  const hasReceiptInput = receiptRows.some((row) => row.currentReceiptQuantity > 0);
  const pendingAction = pendingActionKey ? actionConfigMap[pendingActionKey] : null;
  const remainingBillableAmount =
    doc?.billingSummary && typeof doc.billingSummary === "object"
      ? Number((doc.billingSummary as Record<string, unknown>).remainingBillableAmount || 0)
      : 0;
  const availableSites = Array.isArray(doc?.availableSites)
    ? (doc.availableSites as SiteOption[])
    : [];
  const receiptHistory = Array.isArray(doc?.receiptHistory)
    ? (doc.receiptHistory as ReceiptHistoryItem[])
    : [];

  function openReceiptDrawer() {
    if (availableSites.length === 0) {
      pushToast({
        title: "입고 현장 없음",
        description: "이 프로젝트에 등록된 현장이 없어 입고를 기록할 수 없습니다.",
        tone: "warning",
      });
      return;
    }

    setReceiptDrafts(
      receiptRows.map((row) => ({
        lineNo: row.lineNo,
        quantity: "",
      })),
    );
    setReceiptSiteId((current) =>
      availableSites.some((site) => site.siteId === current)
        ? current
        : availableSites[0]?.siteId ?? "",
    );
    setReceiptStorageLocation("");
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setReceiptDrawerOpen(true);
  }

  function updateReceiptDraft(lineNo: number, value: string) {
    setReceiptDrafts((current) =>
      current.map((item) =>
        item.lineNo === lineNo
          ? {
              ...item,
              quantity: formatIntegerInput(value),
            }
          : item,
      ),
    );
  }

  async function runAction(action: keyof typeof actionConfigMap) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds: [poId] }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: "오류",
          description: json.message || "상태 변경에 실패했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: actionConfigMap[action].label,
        description: "발주 상태를 업데이트했습니다.",
        tone: "success",
      });
      setPendingActionKey(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReceipt() {
    const payload = receiptRows
      .map((row) => ({
        lineNo: row.lineNo,
        quantity: row.currentReceiptQuantity,
        remainingQuantity: row.remainingQuantity,
      }))
      .filter((row) => row.quantity > 0);

    if (payload.length === 0) {
      pushToast({
        title: "입고 수량 확인",
        description: "최소 1개 이상의 금회 입고 수량을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }
    if (!receiptSiteId || !receiptStorageLocation.trim()) {
      pushToast({
        title: "입고 정보 확인",
        description: "입고 현장과 보관위치를 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const exceededLine = payload.find((row) => row.quantity > row.remainingQuantity);
    if (exceededLine) {
      pushToast({
        title: "입고 수량 초과",
        description: `${exceededLine.lineNo}번 라인의 잔량을 초과했습니다.`,
        tone: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: receiptSiteId,
          storageLocation: receiptStorageLocation,
          transactionDate: receiptDate,
          receiptLines: payload.map((row) => ({
            lineNo: row.lineNo,
            quantity: row.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: "입고 등록 실패",
          description: json.message || "입고 수량을 반영하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "입고 등록 완료",
        description: "발주 라인 입고 수량을 반영했습니다.",
        tone: "success",
      });
      setReceiptDrawerOpen(false);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelReceipt(receiptNo: string, reason: string) {
    if (!reason.trim()) {
      pushToast({
        title: "입고 취소 사유 입력 필요",
        description: "입고 취소 사유를 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receipt/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptNo, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: "입고 취소 실패",
          description: json.message || "입고 이력을 취소하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "입고 취소 완료",
        description: `${receiptNo} 입고를 취소했습니다.`,
        tone: "success",
      });
      setPendingReceiptCancelNo(null);
      setReceiptCancelReason("");
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  }

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
          {error || "데이터 없음"}
        </h2>
        <Link href="/supply-chain/purchase-orders" className="mt-4 text-sm text-[color:var(--primary)]">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title={doc.poNo}
        description={`${doc.vendorSnapshot?.name || "-"} · ${doc.projectSnapshot?.name || "-"}`}
        meta={[
          { label: "Database", tone: "success" },
          { label: doc.status, tone: getPurchaseOrderStatusTone(doc.status) },
        ]}
        actions={
          <>
            <Link
              href="/supply-chain/purchase-orders"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            {canEditPurchaseOrder(doc.status) ? (
              <PermissionLink
                permission="purchase-order.update"
                href={`/supply-chain/purchase-orders/${poId}/edit`}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                수정
              </PermissionLink>
            ) : null}
            {canCreateApFromPurchaseOrder(doc.status) && remainingBillableAmount > 0 ? (
              <PermissionLink
                permission="ap.create"
                href={`/finance/ap/new?purchaseOrderId=${poId}`}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                AP 생성
              </PermissionLink>
            ) : null}
            {canSubmitPurchaseOrder(doc.status) ? (
              <PermissionButton
                permission="purchase-order.submit"
                type="button"
                disabled={submitting}
                onClick={() => setPendingActionKey("submit")}
                className={actionClassNames.submit}
              >
                제출
              </PermissionButton>
            ) : null}
            {canApprovePurchaseOrder(doc.status) ? (
              <PermissionButton
                permission="purchase-order.approve"
                type="button"
                disabled={submitting}
                onClick={() => setPendingActionKey("approve")}
                className={actionClassNames.approve}
              >
                승인
              </PermissionButton>
            ) : null}
            {canReceivePurchaseOrder(doc.status) && hasReceivableLines ? (
              <PermissionButton
                permission="purchase-order.receive"
                type="button"
                disabled={submitting || availableSites.length === 0}
                onClick={openReceiptDrawer}
                className={actionClassNames.receive}
              >
                입고 등록
              </PermissionButton>
            ) : null}
            {canRejectPurchaseOrder(doc.status) ? (
              <PermissionButton
                permission="purchase-order.reject"
                type="button"
                disabled={submitting}
                onClick={() => setPendingActionKey("reject")}
                className={actionClassNames.reject}
              >
                반려
              </PermissionButton>
            ) : null}
            {canCancelPurchaseOrderApproval(doc.status) ? (
              <PermissionButton
                permission="purchase-order.cancel-approval"
                type="button"
                disabled={submitting}
                onClick={() => setPendingActionKey("cancel-approval")}
                className={actionClassNames["cancel-approval"]}
              >
                승인 취소
              </PermissionButton>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">발주정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="발주번호" value={doc.poNo} />
            <DetailField label="공급업체" value={doc.vendorSnapshot?.name} />
            <DetailField label="프로젝트" value={doc.projectSnapshot?.name} />
            <DetailField label="발주일" value={doc.orderDate} />
            <DetailField
              label="WBS"
              value={doc.wbsSnapshot ? `${doc.wbsSnapshot.code} ${doc.wbsSnapshot.name}` : "-"}
            />
            <DetailField
              label="실행예산"
              value={
                doc.budgetSnapshot
                  ? `${doc.budgetSnapshot.budgetCode} · ${doc.budgetSnapshot.version}`
                  : "-"
              }
            />
            <DetailField label="납기일" value={doc.dueDate} />
            <DetailField label="통화" value={doc.currency} />
            <DetailField label="총액" value={`₩ ${(doc.totalAmount || 0).toLocaleString()}`} />
            <DetailField
              label="상태"
              value={<StatusBadge label={doc.status} tone={getPurchaseOrderStatusTone(doc.status)} />}
            />
            <DetailField
              label="입고 현황"
              value={`${formatIntegerDisplay(doc.receiptSummary?.receivedQuantity || 0)} / ${formatIntegerDisplay(doc.receiptSummary?.orderedQuantity || 0)}`}
            />
            <DetailField
              label="청구 현황"
              value={`₩ ${formatIntegerDisplay(doc.billingSummary?.billedAmount || 0)} / ₩ ${formatIntegerDisplay(doc.billingSummary?.receivedAmount || 0)}`}
            />
            <DetailField
              label="청구 가능 금액"
              value={`₩ ${formatIntegerDisplay(doc.billingSummary?.remainingBillableAmount || 0)}`}
            />
          </dl>
        </Panel>
      </div>
      {(doc.lines || []).length > 0 ? (
        <DataTable
          title="발주 라인"
          description="발주 품목별 발주수량, 입고수량, 잔량을 확인합니다."
          columns={[
            { key: "itemNo", label: "No." },
            { key: "material", label: "자재" },
            { key: "orderedQty", label: "발주수량", align: "right" },
            { key: "receivedQty", label: "입고수량", align: "right" },
            { key: "remainingQty", label: "잔량", align: "right" },
            { key: "unitPrice", label: "단가", align: "right" },
            { key: "amount", label: "금액", align: "right" },
          ]}
          rows={(doc.lines || []).map((line: Doc, index: number) => {
            const orderedQuantity = Number(line.quantity || 0);
            const receivedQuantity = Number(line.receivedQuantity || 0);
            return {
              itemNo: index + 1,
              material: line.materialSnapshot?.description || line.description || "-",
              orderedQty: formatIntegerDisplay(orderedQuantity),
              receivedQty: formatIntegerDisplay(receivedQuantity),
              remainingQty: formatIntegerDisplay(Math.max(orderedQuantity - receivedQuantity, 0)),
              unitPrice: `₩ ${((line.unitPrice ?? 0) || 0).toLocaleString()}`,
              amount: (
                <span className="font-mono">
                  ₩ {((line.lineAmount ?? line.amount ?? 0) || 0).toLocaleString()}
                </span>
              ),
            };
          })}
        />
      ) : null}
      {receiptHistory.length > 0 ? (
        <DataTable
          title="입고 이력"
          description="입고 배치별 반영 이력입니다. 잘못 반영한 입고는 여기서 취소할 수 있습니다."
          columns={[
            { key: "receiptNo", label: "입고번호" },
            { key: "site", label: "현장" },
            { key: "location", label: "보관위치" },
            { key: "date", label: "입고일" },
            { key: "lines", label: "입고 항목" },
            { key: "status", label: "상태" },
            { key: "notes", label: "비고" },
            { key: "actions", label: "작업" },
          ]}
          rows={receiptHistory.map((entry) => {
            const isCancelable = entry.status === "completed";
            return {
              receiptNo: (
                <div>
                  <div className="font-mono text-sm text-[color:var(--text)]">
                    {entry.receiptNo || "-"}
                  </div>
                </div>
              ),
              site: entry.siteSnapshot
                ? `${entry.siteSnapshot.code || "-"} · ${entry.siteSnapshot.name || "-"}`
                : "-",
              location: entry.storageLocation || "-",
              date: entry.transactionDate || "-",
              lines: (
                <div className="space-y-1 text-xs text-[color:var(--text-muted)]">
                  {(entry.lineItems || []).map((line, index) => (
                    <div key={`${entry.receiptNo}-${line.lineNo ?? index}`}>
                      {line.materialDescription || `라인 ${line.lineNo ?? index + 1}`} ·{" "}
                      {formatIntegerDisplay(line.quantity || 0)} {line.uom || ""}
                    </div>
                  ))}
                </div>
              ),
              status: (
                <div className="space-y-1">
                  <StatusBadge
                    label={entry.status === "canceled" ? "취소됨" : "완료"}
                    tone={entry.status === "canceled" ? "default" : "success"}
                  />
                  {entry.canceledAt ? (
                    <div className="text-xs text-[color:var(--text-muted)]">
                      취소일 {entry.canceledAt}
                    </div>
                  ) : null}
                </div>
              ),
              notes: entry.status === "canceled" ? (
                <div className="text-xs leading-6 text-[color:var(--text-muted)]">
                  {entry.cancelReason || "취소 사유 없음"}
                </div>
              ) : (
                "-"
              ),
              actions: isCancelable ? (
                <PermissionButton
                  permission="purchase-order.cancel-receipt"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingReceiptCancelNo(entry.receiptNo);
                    setReceiptCancelReason("");
                  }}
                  className="rounded-full border border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)]"
                >
                  입고 취소
                </PermissionButton>
              ) : (
                <span className="text-xs text-[color:var(--text-muted)]">취소 완료</span>
              ),
            };
          })}
        />
      ) : null}
      <Drawer
        open={receiptDrawerOpen}
        onClose={() => {
          if (!submitting) {
            setReceiptDrawerOpen(false);
          }
        }}
        eyebrow="Supply Chain"
        title="입고 등록"
        description="라인별 금회 입고 수량을 입력하면 상태가 자동으로 부분 입고 또는 완료로 갱신됩니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => setReceiptDrawerOpen(false)}
              disabled={submitting}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                void submitReceipt();
              }}
              disabled={submitting || !hasReceiptInput}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "반영 중..." : "입고 반영"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              label="입고 현장"
              required
              type="select"
              value={receiptSiteId}
              onChange={setReceiptSiteId}
              options={availableSites.map((site) => ({
                value: site.siteId,
                label: `${site.code} · ${site.name}`,
              }))}
            />
            <FormField
              label="보관위치"
              required
              value={receiptStorageLocation}
              onChange={setReceiptStorageLocation}
              placeholder="예: 자재창고 A-1"
            />
            <DatePicker label="입고일" required value={receiptDate} onChange={setReceiptDate} />
          </div>
          {receiptRows.map((row) => (
            <div
              key={row.lineNo}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
            >
              <div className="text-sm font-semibold text-[color:var(--text)]">
                {row.lineNo}. {row.materialName}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <FormField
                  label="발주수량"
                  type="readonly"
                  value={formatIntegerDisplay(row.orderedQuantity)}
                />
                <FormField
                  label="기입고수량"
                  type="readonly"
                  value={formatIntegerDisplay(row.receivedQuantity)}
                />
                <FormField
                  label="잔량"
                  type="readonly"
                  value={formatIntegerDisplay(row.remainingQuantity)}
                />
              </div>
              <div className="mt-3">
                <FormField
                  label="금회 입고수량"
                  type="text"
                  inputMode="numeric"
                  value={receiptDrafts.find((item) => item.lineNo === row.lineNo)?.quantity ?? ""}
                  onChange={(value) => updateReceiptDraft(row.lineNo, value)}
                  placeholder={row.remainingQuantity > 0 ? "0" : "입고 완료"}
                />
              </div>
              {row.currentReceiptQuantity > row.remainingQuantity ? (
                <p className="mt-3 text-sm font-medium text-[color:var(--danger)]">
                  잔량 {formatIntegerDisplay(row.remainingQuantity)}개를 초과했습니다.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Drawer>
      {pendingAction ? (
        <ConfirmDialog
          open
          title={pendingAction.confirmTitle}
          description={pendingAction.confirmDescription}
          confirmLabel={pendingAction.label}
          tone={pendingAction.tone}
          onClose={() => {
            if (!submitting) {
              setPendingActionKey(null);
            }
          }}
          onConfirm={() => {
            if (!pendingActionKey || submitting) {
              return;
            }
            void runAction(pendingActionKey);
          }}
        />
      ) : null}
      {pendingReceiptCancelNo ? (
        <Drawer
          open
          onClose={() => {
            if (!submitting) {
              setPendingReceiptCancelNo(null);
              setReceiptCancelReason("");
            }
          }}
          eyebrow="Supply Chain"
          title="입고 취소"
          description="입고 수량과 재고가 함께 되돌아갑니다. 이미 소비되었거나 청구가 반영된 입고는 취소되지 않을 수 있습니다."
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (!submitting) {
                    setPendingReceiptCancelNo(null);
                    setReceiptCancelReason("");
                  }
                }}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (!pendingReceiptCancelNo || submitting) {
                    return;
                  }
                  void cancelReceipt(pendingReceiptCancelNo, receiptCancelReason);
                }}
                className="rounded-full border border-[color:var(--danger)] bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "취소 중..." : "입고 취소"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[rgba(201,55,44,0.16)] bg-[rgba(252,235,235,0.72)] px-4 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
              취소 사유는 입고 정정 이력으로 남습니다.
            </div>
            <FormField
              label="입고 취소 사유"
              type="textarea"
              value={receiptCancelReason}
              onChange={setReceiptCancelReason}
              placeholder="예: 잘못된 현장/보관위치로 입고되어 정정"
              rows={4}
            />
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
