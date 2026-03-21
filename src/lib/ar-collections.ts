import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { readArChangeHistory } from "@/lib/ar-history";

type MutableViewerProfile = {
  displayName: string;
  orgUnitName: string;
  email: string;
};

export type ArCollectionHistoryItem = {
  collectionId: string;
  collectionDate: string;
  amount: number;
  method: string;
  note: string;
  createdAt: string;
  createdBy: Record<string, unknown> | null;
  journalEntrySnapshot?: {
    journalEntryId?: string;
    voucherNo?: string;
    status?: string;
  } | null;
};

export type ArCollectionSummary = {
  receivedAmount: number;
  remainingAmount: number;
  lastReceivedAt: string;
  lastCollectionMethod: string;
  collectionCount: number;
};

function normalizeCollectionMethod(value: unknown) {
  return toTrimmedString(value) || "bank-transfer";
}

export function normalizeArCollectionHistory(value: unknown): ArCollectionHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedItems: ArCollectionHistoryItem[] = [];

  for (const [index, item] of value.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      const collectionDate = toTrimmedString(record.collectionDate);
      const amount = toNumberValue(record.amount);
      if (!collectionDate || amount <= 0) {
        continue;
      }

      const journalEntrySnapshot =
        record.journalEntrySnapshot && typeof record.journalEntrySnapshot === "object"
          ? (record.journalEntrySnapshot as Record<string, unknown>)
          : null;

      normalizedItems.push({
        collectionId:
          toTrimmedString(record.collectionId) || `legacy-collection-${index + 1}`,
        collectionDate,
        amount,
        method: normalizeCollectionMethod(record.method),
        note: toTrimmedString(record.note),
        createdAt: toTrimmedString(record.createdAt) || collectionDate,
        createdBy:
          record.createdBy && typeof record.createdBy === "object"
            ? (record.createdBy as Record<string, unknown>)
            : null,
        journalEntrySnapshot: journalEntrySnapshot
          ? {
              journalEntryId: toTrimmedString(journalEntrySnapshot.journalEntryId),
              voucherNo: toTrimmedString(journalEntrySnapshot.voucherNo),
              status: toTrimmedString(journalEntrySnapshot.status),
            }
          : null,
      });
    }

  return normalizedItems;
}

export function buildArCollectionSummary(doc: Record<string, unknown>): ArCollectionSummary {
  const totalAmount = Math.max(toNumberValue(doc.totalAmount), 0);
  const collectionHistory = normalizeArCollectionHistory(doc.collectionHistory);
  let receivedAmount = collectionHistory.reduce((sum, item) => sum + item.amount, 0);
  let lastReceivedAt = collectionHistory[collectionHistory.length - 1]?.collectionDate ?? "";
  let lastCollectionMethod = collectionHistory[collectionHistory.length - 1]?.method ?? "";

  if (collectionHistory.length === 0) {
    const collectionSummary =
      doc.collectionSummary && typeof doc.collectionSummary === "object"
        ? (doc.collectionSummary as Record<string, unknown>)
        : null;
    const explicitReceivedAmount = toNumberValue(collectionSummary?.receivedAmount, -1);

    if (explicitReceivedAmount >= 0) {
      receivedAmount = explicitReceivedAmount;
    } else if (toTrimmedString(doc.status) === "received") {
      receivedAmount = totalAmount;
    }

    lastReceivedAt =
      toTrimmedString(collectionSummary?.lastReceivedAt) ||
      toTrimmedString(collectionSummary?.receivedAt);
    lastCollectionMethod = toTrimmedString(collectionSummary?.lastCollectionMethod);
  }

  const boundedReceivedAmount = Math.min(Math.max(receivedAmount, 0), totalAmount);

  return {
    receivedAmount: boundedReceivedAmount,
    remainingAmount: Math.max(totalAmount - boundedReceivedAmount, 0),
    lastReceivedAt,
    lastCollectionMethod,
    collectionCount: collectionHistory.length,
  };
}

export function resolveEffectiveArStatus(doc: Record<string, unknown>) {
  const status = toTrimmedString(doc.status).toLowerCase();
  if (status === "draft") {
    return "draft";
  }

  const collectionSummary = buildArCollectionSummary(doc);
  if (collectionSummary.remainingAmount <= 0) {
    return "received";
  }
  if (collectionSummary.receivedAmount > 0) {
    return "partial-received";
  }

  const dueDate = toTrimmedString(doc.dueDate);
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < today) {
    return "overdue";
  }

  return "issued";
}

export function serializeArInvoice<T extends Record<string, unknown>>(doc: T) {
  const collectionHistory = normalizeArCollectionHistory(doc.collectionHistory);
  const collectionSummary = buildArCollectionSummary({
    ...doc,
    collectionHistory,
  });

  return {
    ...doc,
    collectionHistory,
    changeHistory: readArChangeHistory(doc.changeHistory, doc),
    collectionSummary: {
      ...collectionSummary,
      receivedAt: collectionSummary.lastReceivedAt,
    },
    status: resolveEffectiveArStatus({
      ...doc,
      collectionHistory,
      collectionSummary,
    }),
  };
}

export function buildArCollectionHistoryItem(input: {
  collectionDate: string;
  amount: number;
  method: string;
  note?: string;
  now: string;
  profile: MutableViewerProfile;
  journalEntrySnapshot?: {
    journalEntryId: string;
    voucherNo: string;
    status: string;
  } | null;
}) {
  return {
    collectionId: `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    collectionDate: input.collectionDate,
    amount: Math.max(input.amount, 0),
    method: normalizeCollectionMethod(input.method),
    note: toTrimmedString(input.note),
    createdAt: input.now,
    createdBy: buildActorSnapshot(input.profile),
    journalEntrySnapshot: input.journalEntrySnapshot ?? null,
  };
}
