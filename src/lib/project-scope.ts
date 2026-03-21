export const currentProjectStorageKey = "smr-erp.current-project.v1";

export type ProjectOption = {
  _id: string;
  code: string;
  name: string;
  status: string;
};

export function normalizeProjectId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeProjectIds(values: unknown) {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalizedValues = [...new Set(values.map((value) => normalizeProjectId(value)).filter(Boolean))];
  return normalizedValues.length > 0 ? normalizedValues : [];
}

export function getProjectIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return normalizeProjectId(url.searchParams.get("projectId"));
}

export function appendProjectIdToPath(path: string, projectId: string | null) {
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("projectId", normalizedProjectId);
  return `${url.pathname}${url.search}`;
}

export function buildProjectFilter(
  projectId: string | null,
  baseFilter: Record<string, unknown> = {},
  allowedProjectIds?: string[] | null,
) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedAllowedProjectIds = normalizeProjectIds(allowedProjectIds);

  if (normalizedProjectId) {
    if (normalizedAllowedProjectIds && !normalizedAllowedProjectIds.includes(normalizedProjectId)) {
      return {
        ...baseFilter,
        "projectSnapshot.projectId": "__forbidden__",
      };
    }

    return {
      ...baseFilter,
      "projectSnapshot.projectId": normalizedProjectId,
    };
  }

  if (normalizedAllowedProjectIds) {
    return {
      ...baseFilter,
      "projectSnapshot.projectId": { $in: normalizedAllowedProjectIds },
    };
  }

  return baseFilter;
}

export function hasProjectAccess(
  projectId: string | null,
  allowedProjectIds?: string[] | null,
) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedAllowedProjectIds = normalizeProjectIds(allowedProjectIds);

  if (!normalizedProjectId) {
    return false;
  }

  if (!normalizedAllowedProjectIds) {
    return true;
  }

  return normalizedAllowedProjectIds.includes(normalizedProjectId);
}

export function buildStringIdFilter(
  fieldName: string,
  value: string | null,
  baseFilter: Record<string, unknown> = {},
  allowedValues?: string[] | null,
) {
  const normalizedValue = normalizeProjectId(value);
  const normalizedAllowedValues = normalizeProjectIds(allowedValues);

  if (normalizedValue) {
    if (normalizedAllowedValues && !normalizedAllowedValues.includes(normalizedValue)) {
      return {
        ...baseFilter,
        [fieldName]: "__forbidden__",
      };
    }

    return {
      ...baseFilter,
      [fieldName]: normalizedValue,
    };
  }

  if (normalizedAllowedValues) {
    return {
      ...baseFilter,
      [fieldName]: { $in: normalizedAllowedValues },
    };
  }

  return baseFilter;
}

export function pickDefaultProjectId(
  currentProjectId: string | null,
  defaultProjectId: string | null,
  projects: ProjectOption[],
) {
  const normalizedCurrentProjectId = normalizeProjectId(currentProjectId);
  const normalizedDefaultProjectId = normalizeProjectId(defaultProjectId);
  const availableProjectIds = new Set(projects.map((project) => project._id));

  if (normalizedCurrentProjectId && availableProjectIds.has(normalizedCurrentProjectId)) {
    return normalizedCurrentProjectId;
  }

  if (normalizedDefaultProjectId && availableProjectIds.has(normalizedDefaultProjectId)) {
    return normalizedDefaultProjectId;
  }

  return null;
}
