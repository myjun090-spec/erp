import type {
  AdminCatalog,
  AdminOrgRecord,
  AdminPolicyRecord,
  AdminRoleRecord,
  AdminUserRecord,
} from "@/lib/admin-catalog";
import { getPermissionMetadata } from "@/lib/navigation";
import type {
  OrgProvisionForm,
  PolicyProvisionForm,
  RoleProvisionForm,
  UserProjectAssignmentForm,
  UserProvisionForm,
} from "./admin-page-types";

export const adminButtonClassName =
  "rounded-full border px-4 py-2 text-sm font-semibold transition";

export function includesSearch(haystack: string[], search: string) {
  if (!search) {
    return true;
  }

  return haystack.join(" ").toLowerCase().includes(search.toLowerCase());
}

export function parsePermissionCodes(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializePermissionCodes(codes: string[]) {
  return codes.join(", ");
}

export function getPermissionDisplay(permission: string) {
  return getPermissionMetadata(permission);
}

export function createEmptyUserForm(catalog: AdminCatalog): UserProvisionForm {
  return {
    id: null,
    name: "",
    email: "",
    employeeNo: "",
    orgUnitCode: catalog.orgUnits[0]?.code ?? "",
    roleCode: catalog.roles[0]?.code ?? "",
    state: "활성",
    defaultProjectId: "",
    projectAssignments: [],
  };
}

export function createUserFormFromRecord(user: AdminUserRecord): UserProvisionForm {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeNo: user.employeeNo,
    orgUnitCode: user.orgUnitCode,
    roleCode: user.roleCode,
    state: user.state === "잠금" ? "비활성" : user.state,
    defaultProjectId: user.defaultProjectId,
    projectAssignments: user.projectAssignments.map((assignment) => ({
      projectId: assignment.projectId,
    })),
  };
}

export function normalizeProjectAssignmentsForPayload(
  assignments: UserProjectAssignmentForm[],
) {
  const assignmentSet = new Set<string>();

  for (const assignment of assignments) {
    const projectId = assignment.projectId.trim();

    if (!projectId) {
      continue;
    }

    assignmentSet.add(projectId);
  }

  return [...assignmentSet].map((projectId) => ({
    projectId,
  }));
}

export function buildUserProvisionPayload(form: UserProvisionForm) {
  return {
    name: form.name,
    email: form.email,
    orgUnitCode: form.orgUnitCode,
    roleCode: form.roleCode,
    state: form.state,
    defaultProjectId: form.defaultProjectId,
    projectAssignments: normalizeProjectAssignmentsForPayload(
      form.projectAssignments,
    ),
  };
}

export function buildUserProvisionPayloadFromRecord(
  user: AdminUserRecord,
  overrides?: Partial<
    Pick<
      UserProvisionForm,
      "orgUnitCode" | "roleCode" | "state" | "defaultProjectId"
    >
  >,
) {
  return {
    name: user.name,
    email: user.email,
    orgUnitCode: overrides?.orgUnitCode ?? user.orgUnitCode,
    roleCode: overrides?.roleCode ?? user.roleCode,
    state: overrides?.state ?? user.state,
    defaultProjectId: overrides?.defaultProjectId ?? user.defaultProjectId,
    projectAssignments: normalizeProjectAssignmentsForPayload(
      user.projectAssignments.map((assignment) => ({
        projectId: assignment.projectId,
      })),
    ),
  };
}

export function createEmptyOrgForm(): OrgProvisionForm {
  return {
    id: null,
    code: "",
    name: "",
    category: "운영",
    leadUserId: "",
    state: "활성",
  };
}

export function createOrgFormFromRecord(
  orgUnit: AdminOrgRecord,
  catalog: AdminCatalog,
): OrgProvisionForm {
  const matchedLeadUser =
    (orgUnit.leadUserId
      ? catalog.users.find((user) => user.id === orgUnit.leadUserId)
      : null) ??
    catalog.users.find((user) => user.email === orgUnit.leadEmail) ??
    catalog.users.find((user) => user.name === orgUnit.leadName);

  return {
    id: orgUnit.id,
    code: orgUnit.code,
    name: orgUnit.name,
    category: orgUnit.category,
    leadUserId: orgUnit.leadUserId ?? matchedLeadUser?.id ?? "",
    state: orgUnit.state,
  };
}

export function createEmptyRoleForm(): RoleProvisionForm {
  return {
    id: null,
    code: "",
    name: "",
    scope: "공통",
    permissionsText: "",
    state: "활성",
  };
}

export function createRoleFormFromRecord(role: AdminRoleRecord): RoleProvisionForm {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    scope: role.scope,
    permissionsText: role.permissions.join(", "),
    state: role.state,
  };
}

export function createEmptyPolicyForm(): PolicyProvisionForm {
  return {
    id: null,
    code: "",
    name: "",
    target: "전체 사용자",
    ruleSummary: "",
    state: "활성",
  };
}

export function createPolicyFormFromRecord(
  policy: AdminPolicyRecord,
): PolicyProvisionForm {
  return {
    id: policy.id,
    code: policy.code,
    name: policy.name,
    target: policy.target,
    ruleSummary: policy.ruleSummary,
    state: policy.state,
  };
}
