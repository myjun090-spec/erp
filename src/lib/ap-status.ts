import { toTrimmedString } from "@/lib/domain-write";

export function normalizeApStatus(value: unknown) {
  return toTrimmedString(value).toLowerCase();
}

export function canApproveAp(status: unknown) {
  return normalizeApStatus(status) === "pending";
}

export function canPayAp(status: unknown) {
  const normalizedStatus = normalizeApStatus(status);
  return (
    normalizedStatus === "approved" ||
    normalizedStatus === "partial-paid" ||
    normalizedStatus === "overdue"
  );
}

export function canCancelApApproval(status: unknown) {
  const normalizedStatus = normalizeApStatus(status);
  return normalizedStatus === "approved" || normalizedStatus === "overdue";
}
