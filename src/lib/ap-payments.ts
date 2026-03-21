import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { normalizeApStatus } from "@/lib/ap-status";

type MutableViewerProfile = {
  displayName: string;
  orgUnitName: string;
  email: string;
};

export type ApPaymentHistoryItem = {
  paymentId: string;
  paymentDate: string;
  amount: number;
  method: string;
  note: string;
  createdAt: string;
  createdBy: Record<string, unknown> | null;
};

export type ApPaymentSummary = {
  paidAmount: number;
  remainingAmount: number;
  lastPaidAt: string;
  lastPaymentMethod: string;
  paymentCount: number;
};

function normalizePaymentMethod(value: unknown) {
  return toTrimmedString(value) || "bank-transfer";
}

export function normalizeApPaymentHistory(value: unknown): ApPaymentHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const paymentDate = toTrimmedString(record.paymentDate);
      const amount = toNumberValue(record.amount);
      if (!paymentDate || amount <= 0) {
        return null;
      }

      return {
        paymentId: toTrimmedString(record.paymentId) || `legacy-payment-${index + 1}`,
        paymentDate,
        amount,
        method: normalizePaymentMethod(record.method),
        note: toTrimmedString(record.note),
        createdAt: toTrimmedString(record.createdAt) || paymentDate,
        createdBy:
          record.createdBy && typeof record.createdBy === "object"
            ? (record.createdBy as Record<string, unknown>)
            : null,
      };
    })
    .filter((item): item is ApPaymentHistoryItem => item !== null);
}

export function buildApPaymentSummary(doc: Record<string, unknown>): ApPaymentSummary {
  const totalAmount = Math.max(toNumberValue(doc.totalAmount), 0);
  const paymentHistory = normalizeApPaymentHistory(doc.paymentHistory);
  let paidAmount = paymentHistory.reduce((sum, item) => sum + item.amount, 0);
  let lastPaidAt = paymentHistory[paymentHistory.length - 1]?.paymentDate ?? "";
  let lastPaymentMethod = paymentHistory[paymentHistory.length - 1]?.method ?? "";

  if (paymentHistory.length === 0) {
    const paymentSummary =
      doc.paymentSummary && typeof doc.paymentSummary === "object"
        ? (doc.paymentSummary as Record<string, unknown>)
        : null;
    const explicitPaidAmount = toNumberValue(paymentSummary?.paidAmount, -1);

    if (explicitPaidAmount >= 0) {
      paidAmount = explicitPaidAmount;
    } else if (normalizeApStatus(doc.status) === "paid") {
      paidAmount = totalAmount;
    }

    lastPaidAt =
      toTrimmedString(paymentSummary?.lastPaidAt) || toTrimmedString(paymentSummary?.paidAt);
    lastPaymentMethod = toTrimmedString(paymentSummary?.lastPaymentMethod);
  }

  const boundedPaidAmount = Math.min(Math.max(paidAmount, 0), totalAmount);

  return {
    paidAmount: boundedPaidAmount,
    remainingAmount: Math.max(totalAmount - boundedPaidAmount, 0),
    lastPaidAt,
    lastPaymentMethod,
    paymentCount: paymentHistory.length,
  };
}

export function resolveEffectiveApStatus(doc: Record<string, unknown>) {
  const status = normalizeApStatus(doc.status);
  const paymentSummary = buildApPaymentSummary(doc);
  const totalAmount = Math.max(toNumberValue(doc.totalAmount), 0);
  const dueDate = toTrimmedString(doc.dueDate);
  const today = new Date().toISOString().slice(0, 10);

  if (status === "pending") {
    return "pending";
  }

  if (totalAmount > 0 && paymentSummary.remainingAmount <= 0) {
    return "paid";
  }

  if (paymentSummary.paidAmount > 0) {
    if (dueDate && dueDate < today && paymentSummary.remainingAmount > 0) {
      return "overdue";
    }
    return "partial-paid";
  }

  if (dueDate && dueDate < today && paymentSummary.remainingAmount > 0) {
    return "overdue";
  }

  return status || "pending";
}

export function serializeApInvoice<T extends Record<string, unknown>>(doc: T) {
  const paymentHistory = normalizeApPaymentHistory(doc.paymentHistory);
  const paymentSummary = buildApPaymentSummary({
    ...doc,
    paymentHistory,
  });

  return {
    ...doc,
    paymentHistory,
    paymentSummary: {
      ...paymentSummary,
      paidAt: paymentSummary.lastPaidAt,
    },
    status: resolveEffectiveApStatus({
      ...doc,
      paymentHistory,
      paymentSummary,
    }),
  };
}

export function buildApPaymentHistoryItem(input: {
  paymentDate: string;
  amount: number;
  method: string;
  note?: string;
  now: string;
  profile: MutableViewerProfile;
}) {
  return {
    paymentId: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paymentDate: input.paymentDate,
    amount: Math.max(input.amount, 0),
    method: normalizePaymentMethod(input.method),
    note: toTrimmedString(input.note),
    createdAt: input.now,
    createdBy: buildActorSnapshot(input.profile),
  };
}
