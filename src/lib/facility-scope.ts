export const currentFacilityStorageKey = "sw-erp.current-facility.v1";

export type FacilityOption = {
  _id: string;
  code: string;
  name: string;
  facilityType: string;
  status: string;
};

export type FacilitySnapshot = {
  facilityId: string;
  code: string;
  name: string;
  facilityType: string;
};

export function buildFacilitySnapshot(facility: Record<string, unknown>): FacilitySnapshot {
  return {
    facilityId: String(facility._id),
    code: String(facility.code ?? ""),
    name: String(facility.name ?? ""),
    facilityType: String(facility.facilityType ?? ""),
  };
}

export function normalizeFacilityId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeFacilityIds(values: unknown) {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalizedValues = [...new Set(values.map((value) => normalizeFacilityId(value)).filter(Boolean))];
  return normalizedValues.length > 0 ? normalizedValues : [];
}

export function getFacilityIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return normalizeFacilityId(url.searchParams.get("facilityId"));
}

export function appendFacilityIdToPath(path: string, facilityId: string | null) {
  const normalizedFacilityId = normalizeFacilityId(facilityId);

  if (!normalizedFacilityId) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("facilityId", normalizedFacilityId);
  return `${url.pathname}${url.search}`;
}

export function buildFacilityFilter(
  facilityId: string | null,
  baseFilter: Record<string, unknown> = {},
  allowedFacilityIds?: string[] | null,
) {
  const normalizedFacilityId = normalizeFacilityId(facilityId);
  const normalizedAllowedFacilityIds = normalizeFacilityIds(allowedFacilityIds);

  if (normalizedFacilityId) {
    if (normalizedAllowedFacilityIds && !normalizedAllowedFacilityIds.includes(normalizedFacilityId)) {
      return {
        ...baseFilter,
        "facilitySnapshot.facilityId": "__forbidden__",
      };
    }

    return {
      ...baseFilter,
      "facilitySnapshot.facilityId": normalizedFacilityId,
    };
  }

  if (normalizedAllowedFacilityIds) {
    return {
      ...baseFilter,
      "facilitySnapshot.facilityId": { $in: normalizedAllowedFacilityIds },
    };
  }

  return baseFilter;
}

export function hasFacilityAccess(
  facilityId: string | null,
  allowedFacilityIds?: string[] | null,
) {
  const normalizedFacilityId = normalizeFacilityId(facilityId);
  const normalizedAllowedFacilityIds = normalizeFacilityIds(allowedFacilityIds);

  if (!normalizedFacilityId) {
    return false;
  }

  if (!normalizedAllowedFacilityIds) {
    return true;
  }

  return normalizedAllowedFacilityIds.includes(normalizedFacilityId);
}

export function pickDefaultFacilityId(
  currentFacilityId: string | null,
  defaultFacilityId: string | null,
  facilities: FacilityOption[],
) {
  const normalizedCurrentFacilityId = normalizeFacilityId(currentFacilityId);
  const normalizedDefaultFacilityId = normalizeFacilityId(defaultFacilityId);
  const availableFacilityIds = new Set(facilities.map((facility) => facility._id));

  if (normalizedCurrentFacilityId && availableFacilityIds.has(normalizedCurrentFacilityId)) {
    return normalizedCurrentFacilityId;
  }

  if (normalizedDefaultFacilityId && availableFacilityIds.has(normalizedDefaultFacilityId)) {
    return normalizedDefaultFacilityId;
  }

  return null;
}

/** @deprecated alias for hasFacilityAccess – used by legacy finance routes */
export const hasProjectAccess = hasFacilityAccess;

/** @deprecated alias for pickDefaultFacilityId – used by legacy finance pages */
export const pickDefaultProjectId = pickDefaultFacilityId;

// getFacilityAccessScope moved to @/lib/facility-access (server-only)
