import type { ViewerProfile } from "@/lib/navigation";

const protectedCreateFields = new Set([
  "_id",
  "tenantId",
  "schemaVersion",
  "documentVersion",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "archivedAt",
  "auditTrailId",
]);

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

export function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toNumberValue(value: unknown, fallback = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function toBooleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function stripProtectedCreateFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !protectedCreateFields.has(key)),
  );
}

export function resolveStatus(value: unknown, fallback: string) {
  const trimmedValue = toTrimmedString(value);
  return trimmedValue || fallback;
}

export function buildActorSnapshot(profile: MutableViewerProfile) {
  return {
    userId: profile.email,
    employeeNo: "",
    displayName: profile.displayName,
    orgUnitName: profile.orgUnitName,
  };
}

export function buildCreateMetadata(profile: MutableViewerProfile, now: string) {
  const actorSnapshot = buildActorSnapshot(profile);

  return {
    tenantId: "smr-default",
    schemaVersion: 1,
    documentVersion: 1,
    createdAt: now,
    createdBy: actorSnapshot,
    updatedAt: now,
    updatedBy: actorSnapshot,
  };
}
