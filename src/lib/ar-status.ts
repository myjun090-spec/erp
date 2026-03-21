import { toNumberValue } from "@/lib/domain-write";
import { resolveEffectiveArStatus } from "@/lib/ar-collections";

export function canIssueAr(status: unknown) {
  return String(status || "").trim().toLowerCase() === "draft";
}

export function canCollectAr(status: unknown) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return (
    normalizedStatus === "issued" ||
    normalizedStatus === "partial-received" ||
    normalizedStatus === "overdue"
  );
}

export function canCancelArIssue(
  status: unknown,
  receivedAmount: unknown,
) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  return (
    (normalizedStatus === "issued" || normalizedStatus === "overdue") &&
    toNumberValue(receivedAmount) <= 0
  );
}

export function canCancelArCollection(status: unknown, collectionCount: unknown) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedCollectionCount = toNumberValue(collectionCount);

  return (
    normalizedCollectionCount > 0 &&
    (normalizedStatus === "partial-received" || normalizedStatus === "received")
  );
}

export function canCollectArDocument(doc: Record<string, unknown>) {
  return canCollectAr(resolveEffectiveArStatus(doc));
}
