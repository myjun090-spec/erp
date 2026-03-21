export type AdminProjectOptionRecord = {
  projectId: string;
  code: string;
  name: string;
  status: string;
};

export type AdminUserProjectAssignmentRecord = {
  projectId: string;
  projectCode: string;
  projectName: string;
};

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  employeeNo: string;
  orgUnitCode: string;
  orgUnitName: string;
  roleCode: string;
  roleName: string;
  provider: string;
  state: string;
  lastSeenAt: string;
  defaultProjectId: string;
  projectAssignments: AdminUserProjectAssignmentRecord[];
};

export type AdminOrgRecord = {
  id: string;
  code: string;
  name: string;
  category: string;
  leadName: string;
  leadUserId?: string;
  leadEmail?: string;
  memberCount: number;
  state: string;
};

export type AdminRoleRecord = {
  id: string;
  code: string;
  name: string;
  scope: string;
  memberCount: number;
  state: string;
  permissions: string[];
};

export type AdminPolicyRecord = {
  id: string;
  code: string;
  name: string;
  target: string;
  state: string;
  ruleSummary: string;
};

export type AdminCatalog = {
  users: AdminUserRecord[];
  orgUnits: AdminOrgRecord[];
  roles: AdminRoleRecord[];
  policies: AdminPolicyRecord[];
  projectOptions: AdminProjectOptionRecord[];
};

export const emptyAdminCatalog: AdminCatalog = {
  users: [],
  orgUnits: [],
  roles: [],
  policies: [],
  projectOptions: [],
};
