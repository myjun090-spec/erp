"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BudgetLinkFields } from "@/components/domain/budget-link-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { generateApInvoiceNo } from "@/lib/document-numbers";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type VendorOption = {
  _id: string;
  code: string;
  name: string;
};

type PurchaseOrderReference = {
  _id: string;
  poNo: string;
  status: string;
  vendorSnapshot: { name: string } | null;
  projectSnapshot: { projectId?: string; name: string } | null;
  wbsSnapshot: { wbsId?: string; name: string } | null;
  budgetSnapshot: { budgetId?: string; budgetCode: string; version: string } | null;
  currency: string;
  totalAmount: number;
  billingSummary?: {
    receivedAmount?: number;
    billedAmount?: number;
    remainingBillableAmount?: number;
  } | null;
  lines?: Array<{
    receivedQuantity?: number;
    unitPrice?: number;
  }>;
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingReference, setLoadingReference] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [wbsId, setWbsId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [purchaseOrderRef, setPurchaseOrderRef] = useState<PurchaseOrderReference | null>(null);
  const [form, setForm] = useState(() => ({
    invoiceNo: generateApInvoiceNo(),
    invoiceDate: getToday(),
    dueDate: getToday(),
    totalAmount: "",
    currency: "KRW",
  }));

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "totalAmount" ? formatIntegerInput(value) : value,
    }));
  };

  const remainingBillableAmount =
    purchaseOrderRef && purchaseOrderRef.billingSummary
      ? Number(purchaseOrderRef.billingSummary.remainingBillableAmount || 0)
      : 0;
  const receivedAmount =
    purchaseOrderRef && purchaseOrderRef.billingSummary
      ? Number(purchaseOrderRef.billingSummary.receivedAmount || 0)
      : 0;
  const billedAmount =
    purchaseOrderRef && purchaseOrderRef.billingSummary
      ? Number(purchaseOrderRef.billingSummary.billedAmount || 0)
      : 0;
  const requestedApAmount = parseFormattedInteger(form.totalAmount);
  const isBillableAmountExceeded =
    !!purchaseOrderRef && requestedApAmount > remainingBillableAmount;

  useEffect(() => {
    let cancelled = false;

    async function loadVendors() {
      try {
        const res = await fetch("/api/vendors");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setVendors(json.data.items ?? []);
        }
      } catch {
        if (!cancelled) {
          pushToast({
            title: "공급업체 조회 실패",
            description: "공급업체 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
        }
      }
    }

    void loadVendors();
    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    const purchaseOrderId = searchParams.get("purchaseOrderId");
    if (!purchaseOrderId) {
      setPurchaseOrderRef(null);
      return;
    }

    const controller = new AbortController();

    async function loadPurchaseOrderReference() {
      setLoadingReference(true);
      try {
        const res = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) {
          return;
        }

        if (!json.ok) {
          setPurchaseOrderRef(null);
          pushToast({
            title: "발주 조회 실패",
            description: json.message || "참조 발주를 불러오지 못했습니다.",
            tone: "warning",
          });
          return;
        }

        const doc = json.data as PurchaseOrderReference & Record<string, unknown>;
        const purchaseOrderLines = Array.isArray(doc.lines) ? doc.lines : [];
        const computedReceivedAmount = purchaseOrderLines.reduce((sum, line) => {
          const receivedQuantity =
            typeof line.receivedQuantity === "number"
              ? line.receivedQuantity
              : Number(line.receivedQuantity || 0);
          const unitPrice =
            typeof line.unitPrice === "number" ? line.unitPrice : Number(line.unitPrice || 0);
          return sum + receivedQuantity * unitPrice;
        }, 0);
        const nextRemainingBillableAmount =
          doc.billingSummary && typeof doc.billingSummary === "object"
            ? Number((doc.billingSummary as Record<string, unknown>).remainingBillableAmount || 0)
            : computedReceivedAmount;
        setPurchaseOrderRef(doc);
        setProjectId(
          doc.projectSnapshot && typeof doc.projectSnapshot === "object"
            ? String(doc.projectSnapshot.projectId ?? "")
            : "",
        );
        setWbsId(
          doc.wbsSnapshot && typeof doc.wbsSnapshot === "object"
            ? String(doc.wbsSnapshot.wbsId ?? "")
            : "",
        );
        setBudgetId(
          doc.budgetSnapshot && typeof doc.budgetSnapshot === "object"
            ? String(doc.budgetSnapshot.budgetId ?? "")
            : "",
        );
        setForm((prev) => ({
          ...prev,
          totalAmount:
            prev.totalAmount ||
            formatIntegerInput(
              nextRemainingBillableAmount > 0
                ? nextRemainingBillableAmount
                : computedReceivedAmount > 0
                  ? computedReceivedAmount
                : typeof doc.totalAmount === "number"
                  ? doc.totalAmount
                  : Number(doc.totalAmount || 0),
            ),
          currency:
            typeof doc.currency === "string" && doc.currency ? doc.currency : prev.currency,
        }));
      } catch {
        if (!controller.signal.aborted) {
          setPurchaseOrderRef(null);
          pushToast({
            title: "발주 조회 실패",
            description: "참조 발주를 불러오는 중 오류가 발생했습니다.",
            tone: "warning",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingReference(false);
        }
      }
    }

    void loadPurchaseOrderReference();
    return () => controller.abort();
  }, [pushToast, searchParams]);

  const handleSubmit = async () => {
    if (
      (!purchaseOrderRef && (!vendorId || !projectId || !wbsId || !budgetId)) ||
      !form.invoiceDate ||
      !form.dueDate ||
      !form.totalAmount
    ) {
      pushToast({
        title: "필수 입력",
        description: "공급업체, 프로젝트, WBS, 실행예산, 송장일, 만기일, 총액을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (purchaseOrderRef && requestedApAmount > remainingBillableAmount) {
      pushToast({
        title: "청구 가능 금액 초과",
        description: `남은 청구 가능 금액 ${remainingBillableAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          projectId,
          wbsId,
          budgetId,
          purchaseOrderId: purchaseOrderRef?._id ?? "",
          invoiceDate: form.invoiceDate,
          dueDate: form.dueDate,
          totalAmount: parseFormattedInteger(form.totalAmount),
          currency: form.currency,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        pushToast({
          title: "등록 완료",
          description: "AP가 등록되었습니다.",
          tone: "success",
        });
        router.push("/finance/ap");
        return;
      }

      pushToast({
        title: "등록 실패",
        description: json.message || "AP를 저장하지 못했습니다.",
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
        title="AP 등록"
        description={
          purchaseOrderRef
            ? "발주 참조 정보를 기준으로 AP를 등록합니다."
            : "매입전표와 실행예산 연결 정보를 함께 등록합니다."
        }
        actions={
          <>
            <Link
              href="/finance/ap"
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
        {purchaseOrderRef ? (
          <>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4">
              <div className="text-xs font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                참조 발주
              </div>
              <div className="mt-2 text-sm text-[color:var(--text)]">
                {purchaseOrderRef.poNo} · {purchaseOrderRef.vendorSnapshot?.name || "-"}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                {purchaseOrderRef.projectSnapshot?.name || "-"} / {purchaseOrderRef.wbsSnapshot?.name || "-"} /{" "}
                {purchaseOrderRef.budgetSnapshot
                  ? `${purchaseOrderRef.budgetSnapshot.budgetCode} · ${purchaseOrderRef.budgetSnapshot.version}`
                  : "-"}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField label="공급업체" type="readonly" value={purchaseOrderRef.vendorSnapshot?.name || "-"} />
              <FormField label="프로젝트" type="readonly" value={purchaseOrderRef.projectSnapshot?.name || "-"} />
              <FormField label="WBS" type="readonly" value={purchaseOrderRef.wbsSnapshot?.name || "-"} />
              <FormField
                label="실행예산 버전"
                type="readonly"
                value={
                  purchaseOrderRef.budgetSnapshot
                    ? `${purchaseOrderRef.budgetSnapshot.budgetCode} · ${purchaseOrderRef.budgetSnapshot.version}`
                    : "-"
                }
              />
              <FormField label="발주 통화" type="readonly" value={purchaseOrderRef.currency || "-"} />
              <FormField label="발주 총액" type="readonly" value={formatIntegerInput(purchaseOrderRef.totalAmount || 0)} />
              <FormField label="기입고 금액" type="readonly" value={formatIntegerInput(receivedAmount)} />
              <FormField label="승인 청구 금액" type="readonly" value={formatIntegerInput(billedAmount)} />
              <FormField label="남은 청구 가능 금액" type="readonly" value={formatIntegerInput(remainingBillableAmount)} />
            </div>
          </>
        ) : (
          <>
            <BudgetLinkFields
              projectId={projectId}
              wbsId={wbsId}
              budgetId={budgetId}
              onProjectChange={setProjectId}
              onWbsChange={setWbsId}
              onBudgetChange={setBudgetId}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="공급업체"
                required
                type="select"
                value={vendorId}
                onChange={setVendorId}
                options={vendors.map((vendor) => ({
                  value: vendor._id,
                  label: `${vendor.code} · ${vendor.name}`,
                }))}
              />
            </div>
          </>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="송장번호"
            required
            type="readonly"
            value={form.invoiceNo}
          />
          <DatePicker label="송장일" required value={form.invoiceDate} onChange={update("invoiceDate")} />
          <DatePicker label="만기일" required value={form.dueDate} onChange={update("dueDate")} />
          <FormField
            label="총액"
            required
            type="text"
            inputMode="numeric"
            value={form.totalAmount}
            onChange={update("totalAmount")}
            placeholder="0"
          />
          <FormField
            label="통화"
            type="select"
            value={form.currency}
            onChange={update("currency")}
            options={[
              { label: "KRW", value: "KRW" },
              { label: "USD", value: "USD" },
            ]}
          />
        </div>
        {loadingReference ? (
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">참조 발주 정보를 불러오는 중입니다.</p>
        ) : null}
        {purchaseOrderRef ? (
          isBillableAmountExceeded ? (
            <p className="mt-4 text-sm font-medium text-[color:var(--danger)]">
              입력 금액이 남은 청구 가능 금액 {remainingBillableAmount.toLocaleString()}원을 초과했습니다.
            </p>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">
              남은 청구 가능 금액은 {remainingBillableAmount.toLocaleString()}원입니다.
            </p>
          )
        ) : null}
      </Panel>
    </>
  );
}
