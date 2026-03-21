import type { Db } from "mongodb";
import { buildCreateMetadata, resolveStatus, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { buildMaterialSnapshot } from "@/lib/material-snapshot";
import { buildProjectSnapshot } from "@/lib/project-sites";
import { buildSiteSnapshot } from "@/lib/project-units";
import type { ViewerProfile } from "@/lib/navigation";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

const allowedInventoryTransactionTypes = new Set([
  "receipt",
  "issue",
  "return",
  "adjustment",
  "transfer",
]);

const completedInventoryStatuses = new Set(["", "completed", "confirmed"]);
const allowedInventoryQualityStatuses = new Set([
  "available",
  "quality-hold",
  "blocked",
]);

export function normalizeInventoryTransactionType(value: unknown) {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  return allowedInventoryTransactionTypes.has(normalizedValue)
    ? normalizedValue
    : "adjustment";
}

export function normalizeInventoryTransactionStatus(value: unknown) {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  if (normalizedValue === "confirmed") {
    return "completed";
  }
  return normalizedValue || "completed";
}

export function normalizeInventoryQualityStatus(value: unknown) {
  const normalizedValue = toTrimmedString(value).toLowerCase();
  return allowedInventoryQualityStatuses.has(normalizedValue)
    ? normalizedValue
    : "available";
}

export function isCompletedInventoryStatus(value: unknown) {
  return completedInventoryStatuses.has(toTrimmedString(value).toLowerCase());
}

export function buildReferenceSnapshot(
  referenceType: string,
  referenceId: string,
  referenceNo: string,
  referenceName: string,
) {
  return {
    referenceType: toTrimmedString(referenceType),
    referenceId: toTrimmedString(referenceId),
    referenceNo: toTrimmedString(referenceNo),
    referenceName: toTrimmedString(referenceName),
  };
}

export function buildInventoryTransactionDocument(
  project: Record<string, unknown>,
  site: Record<string, unknown>,
  material: Record<string, unknown>,
  profile: MutableViewerProfile,
  input: {
    storageLocation: string;
    transactionType: string;
    quantity: number;
    transactionDate: string;
    adjustmentDirection?: string;
    adjustmentReason?: string;
    targetSiteSnapshot?: Record<string, unknown> | null;
    targetStorageLocation?: string;
    lotNo?: string;
    serialNo?: string;
    expiryDate?: string;
    qualityStatus?: string;
    referenceSnapshot?: Record<string, unknown> | null;
    status?: string;
  },
  now: string,
) {
  return {
    materialSnapshot: buildMaterialSnapshot(material),
    projectSnapshot: buildProjectSnapshot(project),
    siteSnapshot: buildSiteSnapshot(site),
    storageLocation: toTrimmedString(input.storageLocation),
    transactionType: normalizeInventoryTransactionType(input.transactionType),
    quantity: toNumberValue(input.quantity),
    uom: toTrimmedString(material.uom),
    transactionDate: toTrimmedString(input.transactionDate) || now.slice(0, 10),
    adjustmentDirection: toTrimmedString(input.adjustmentDirection),
    adjustmentReason: toTrimmedString(input.adjustmentReason),
    targetSiteSnapshot: input.targetSiteSnapshot ?? null,
    targetStorageLocation: toTrimmedString(input.targetStorageLocation),
    lotNo: toTrimmedString(input.lotNo),
    serialNo: toTrimmedString(input.serialNo),
    expiryDate: toTrimmedString(input.expiryDate),
    qualityStatus: normalizeInventoryQualityStatus(input.qualityStatus),
    referenceSnapshot: input.referenceSnapshot ?? null,
    status: normalizeInventoryTransactionStatus(resolveStatus(input.status, "completed")),
    ...buildCreateMetadata(profile, now),
  };
}

export async function summarizeInventoryByMaterial(
  db: Db,
  materialId: string,
  projectId?: string | null,
) {
  return summarizeInventoryBalance(db, {
    materialId,
    projectId,
  });
}

export async function summarizeInventoryBalance(
  db: Db,
  filterInput: {
    materialId: string;
    projectId?: string | null;
    siteId?: string | null;
    storageLocation?: string | null;
    lotNo?: string | null;
    serialNo?: string | null;
    expiryDate?: string | null;
    qualityStatus?: string | null;
  },
) {
  const filter: Record<string, unknown> = {
    "materialSnapshot.materialId": filterInput.materialId,
  };
  if (filterInput.projectId) {
    filter["projectSnapshot.projectId"] = filterInput.projectId;
  }
  if (filterInput.siteId) {
    filter["siteSnapshot.siteId"] = filterInput.siteId;
  }
  if (filterInput.storageLocation) {
    filter.storageLocation = filterInput.storageLocation;
  }
  if (filterInput.lotNo) {
    filter.lotNo = filterInput.lotNo;
  }
  if (filterInput.serialNo) {
    filter.serialNo = filterInput.serialNo;
  }
  if (filterInput.expiryDate) {
    filter.expiryDate = filterInput.expiryDate;
  }
  if (filterInput.qualityStatus) {
    filter.qualityStatus = filterInput.qualityStatus;
  }

  const docs = await db
    .collection("inventory_transactions")
    .find(filter)
    .project({ transactionType: 1, quantity: 1, adjustmentDirection: 1, status: 1 })
    .toArray();

  return docs.reduce((sum, doc) => {
    if (!isCompletedInventoryStatus(doc.status)) {
      return sum;
    }

    const quantity = toNumberValue(doc.quantity);
    const transactionType = normalizeInventoryTransactionType(doc.transactionType);
    if (transactionType === "transfer") {
      return sum;
    }
    if (transactionType === "issue") {
      return sum - quantity;
    }
    if (transactionType === "adjustment") {
      return toTrimmedString(doc.adjustmentDirection) === "decrease"
        ? sum - quantity
        : sum + quantity;
    }
    return sum + quantity;
  }, 0);
}
