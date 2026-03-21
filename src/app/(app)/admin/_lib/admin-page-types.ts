"use client";

export type AdminTabValue =
  | "users"
  | "orgs"
  | "roles"
  | "policies";

export type ProvisionAdminTabValue =
  | "users"
  | "orgs"
  | "roles"
  | "policies";

export type DialogMode = "detail" | null;

export type UserProjectAssignmentForm = {
  projectId: string;
};

export type UserProvisionForm = {
  id: string | null;
  name: string;
  email: string;
  employeeNo: string;
  orgUnitCode: string;
  roleCode: string;
  state: string;
  defaultProjectId: string;
  projectAssignments: UserProjectAssignmentForm[];
};

export type OrgProvisionForm = {
  id: string | null;
  code: string;
  name: string;
  category: string;
  leadUserId: string;
  state: string;
};

export type RoleProvisionForm = {
  id: string | null;
  code: string;
  name: string;
  scope: string;
  permissionsText: string;
  state: string;
};

export type PolicyProvisionForm = {
  id: string | null;
  code: string;
  name: string;
  target: string;
  ruleSummary: string;
  state: string;
};

export type AdminSummaryItem = {
  label: string;
  value: string;
  caption: string;
};
