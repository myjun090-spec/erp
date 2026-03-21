import type { StatusBadge } from "@/components/ui/status-badge";

type StatusTone = NonNullable<Parameters<typeof StatusBadge>[0]["tone"]>;

const purchaseOrderStatusToneMap: Record<string, StatusTone> = {
  draft: "default",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  "partial-received": "warning",
  completed: "success",
};

export function getPurchaseOrderStatusTone(status: string) {
  return purchaseOrderStatusToneMap[status] ?? "default";
}

export function canSubmitPurchaseOrder(status: string) {
  return status === "draft";
}

export function canEditPurchaseOrder(status: string) {
  return status === "draft" || status === "submitted";
}

export function canCreateApFromPurchaseOrder(status: string) {
  return status === "partial-received" || status === "completed";
}

export function canApprovePurchaseOrder(status: string) {
  return status === "submitted";
}

export function canRejectPurchaseOrder(status: string) {
  return status === "submitted";
}

export function canCancelPurchaseOrderApproval(status: string) {
  return status === "approved";
}

export function canPartiallyReceivePurchaseOrder(status: string) {
  return status === "approved";
}

export function canCompletePurchaseOrder(status: string) {
  return status === "approved" || status === "partial-received";
}

export function canReceivePurchaseOrder(status: string) {
  return status === "approved" || status === "partial-received";
}
