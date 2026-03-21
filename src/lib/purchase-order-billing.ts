import { ObjectId, type ClientSession, type Db } from "mongodb";
import { toNumberValue } from "@/lib/domain-write";

const billedApStatuses = new Set(["approved", "partial-paid", "paid", "overdue"]);

function normalizePurchaseOrderId(value: unknown) {
  if (value instanceof ObjectId) {
    return value.toString();
  }
  return typeof value === "string" ? value.trim() : "";
}

export function calculatePurchaseOrderReceivedAmount(
  lines: unknown,
) {
  if (!Array.isArray(lines)) {
    return 0;
  }

  return lines.reduce((sum, item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const receivedQuantity = toNumberValue(record.receivedQuantity);
    const unitPrice = toNumberValue(record.unitPrice);
    return sum + receivedQuantity * unitPrice;
  }, 0);
}

export async function calculatePurchaseOrderBilledAmount(
  db: Db,
  purchaseOrderId: string,
  options?: {
    excludeApIds?: ObjectId[];
    session?: ClientSession;
  },
) {
  const normalizedPurchaseOrderId = normalizePurchaseOrderId(purchaseOrderId);
  if (!normalizedPurchaseOrderId) {
    return 0;
  }

  const excludeApIds = options?.excludeApIds ?? [];
  const filter: Record<string, unknown> = {
    "sourceSnapshot.sourceType": "purchase_order",
    "sourceSnapshot.sourceId": normalizedPurchaseOrderId,
    status: { $in: [...billedApStatuses] },
  };

  if (excludeApIds.length > 0) {
    filter._id = { $nin: excludeApIds };
  }

  const docs = await db
    .collection("ap_invoices")
    .find(filter, {
      session: options?.session,
    })
    .project({ totalAmount: 1 })
    .toArray();

  return docs.reduce((sum, doc) => sum + toNumberValue(doc.totalAmount), 0);
}

export async function buildPurchaseOrderBillingSummary(
  db: Db,
  purchaseOrder: Record<string, unknown>,
  options?: {
    excludeApIds?: ObjectId[];
    session?: ClientSession;
  },
) {
  const purchaseOrderId = normalizePurchaseOrderId(purchaseOrder._id);
  const receivedAmount = calculatePurchaseOrderReceivedAmount(purchaseOrder.lines);
  const billedAmount = purchaseOrderId
    ? await calculatePurchaseOrderBilledAmount(db, purchaseOrderId, options)
    : 0;

  return {
    receivedAmount,
    billedAmount,
    remainingBillableAmount: Math.max(receivedAmount - billedAmount, 0),
  };
}
