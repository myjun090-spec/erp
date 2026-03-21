"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import {
  emptyAdminCatalog,
  type AdminCatalog,
  type AdminOrgRecord,
  type AdminPolicyRecord,
  type AdminRoleRecord,
  type AdminUserRecord,
} from "@/lib/admin-catalog";
import { type AuditLogRecord } from "@/lib/platform-catalog";
import {
  AdminAuditLogPanel,
} from "./_components/admin-audit-log-panel";
import { formatIntegerDisplay } from "@/lib/number-input";
import { canAccessAction } from "@/lib/navigation";
import { AdminDetailDialog } from "./_components/admin-detail-dialog";
import { AdminOrgsPanel } from "./_components/admin-orgs-panel";
import { AdminPoliciesPanel } from "./_components/admin-policies-panel";
import { AdminRolesPanel } from "./_components/admin-roles-panel";
import { AdminSummaryCards } from "./_components/admin-summary-cards";
import { AdminUsersPanel } from "./_components/admin-users-panel";
import {
  adminButtonClassName,
  buildUserProvisionPayload,
  buildUserProvisionPayloadFromRecord,
  createEmptyOrgForm,
  createEmptyPolicyForm,
  createEmptyRoleForm,
  createEmptyUserForm,
  createOrgFormFromRecord,
  createPolicyFormFromRecord,
  createRoleFormFromRecord,
  createUserFormFromRecord,
  getPermissionDisplay,
  includesSearch,
  parsePermissionCodes,
  serializePermissionCodes,
} from "./_lib/admin-page-helpers";
import type {
  AdminTabValue,
  DialogMode,
  PolicyProvisionForm,
  ProvisionAdminTabValue,
  RoleProvisionForm,
  UserProvisionForm,
  OrgProvisionForm,
} from "./_lib/admin-page-types";

const stateToneMap = {
  활성: "success",
  검토중: "warning",
  잠금: "danger",
  비활성: "danger",
  설계중: "info",
} as const;

function getStatusBadge(state: keyof typeof stateToneMap) {
  return <StatusBadge label={state} tone={stateToneMap[state]} />;
}

const rolePermissionPreviewCount = 2;

type AdminCatalogApiPayload = {
  catalog?: AdminCatalog;
  auditLogs?: AuditLogRecord[];
  source?: "database" | "empty";
  error?: string | null;
};

export default function AdminPage() {
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [adminCatalog, setAdminCatalog] = useState<AdminCatalog>(emptyAdminCatalog);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [catalogSource, setCatalogSource] = useState<"database" | "empty">("empty");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabValue>("users");
  const [searchValue, setSearchValue] = useState("");
  const [firstFilter, setFirstFilter] = useState("all");
  const [secondFilter, setSecondFilter] = useState("all");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [policyDrawerOpen, setPolicyDrawerOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserProvisionForm>(() =>
    createEmptyUserForm(emptyAdminCatalog),
  );
  const [orgForm, setOrgForm] = useState<OrgProvisionForm>(createEmptyOrgForm);
  const [roleForm, setRoleForm] = useState<RoleProvisionForm>(createEmptyRoleForm);
  const [policyForm, setPolicyForm] = useState<PolicyProvisionForm>(createEmptyPolicyForm);
  const [isUserSaving, setIsUserSaving] = useState(false);
  const [orgMemberSavingUserId, setOrgMemberSavingUserId] = useState<string | null>(null);
  const [metaSavingTarget, setMetaSavingTarget] = useState<
    "orgs" | "roles" | "policies" | null
  >(null);
  const deferredSearch = useDeferredValue(searchValue);
  const [orgLeadSearch, setOrgLeadSearch] = useState("");
  const deferredLeadSearch = useDeferredValue(orgLeadSearch);
  const [orgMemberSearch, setOrgMemberSearch] = useState("");
  const deferredOrgMemberSearch = useDeferredValue(orgMemberSearch);
  const [orgMemberMoveTargets, setOrgMemberMoveTargets] = useState<
    Record<string, string>
  >({});
  const projectOptionMap = new Map(
    adminCatalog.projectOptions.map((project) => [project.projectId, project] as const),
  );
  const isProvisionTab =
    activeTab === "users" ||
    activeTab === "orgs" ||
    activeTab === "roles" ||
    activeTab === "policies";
  const canCreateUsers = canAccessAction(viewerPermissions, "admin.user.create");
  const canUpdateUsers = canAccessAction(viewerPermissions, "admin.user.update");
  const canCreateOrgs = canAccessAction(viewerPermissions, "admin.org.create");
  const canUpdateOrgs = canAccessAction(viewerPermissions, "admin.org.update");
  const canCreateRoles = canAccessAction(viewerPermissions, "admin.role.create");
  const canUpdateRoles = canAccessAction(viewerPermissions, "admin.role.update");
  const canCreatePolicies = canAccessAction(viewerPermissions, "admin.policy.create");
  const canUpdatePolicies = canAccessAction(viewerPermissions, "admin.policy.update");
  const canUpdateActiveTab =
    activeTab === "users"
      ? canUpdateUsers
      : activeTab === "orgs"
        ? canUpdateOrgs
        : activeTab === "roles"
          ? canUpdateRoles
          : canUpdatePolicies;

  useEffect(() => {
    let ignore = false;

    async function loadAdminCatalog() {
      try {
        const response = await fetch("/api/admin/catalog", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as AdminCatalogApiPayload;

        if (ignore || !payload.catalog) {
          return;
        }

        setAdminCatalog(payload.catalog);
        setAuditLogs(payload.auditLogs ?? []);
        setCatalogSource(payload.source === "database" ? "database" : "empty");
        setCatalogError(payload.error ?? null);
      } catch {
        setCatalogError("관리자 카탈로그 API를 읽지 못했습니다.");
      }
    }

    void loadAdminCatalog();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setUserForm((current) => {
      if (current.id) {
        const matchedUser = adminCatalog.users.find((user) => user.id === current.id);
        return matchedUser
          ? createUserFormFromRecord(matchedUser)
          : createEmptyUserForm(adminCatalog);
      }

      if (current.orgUnitCode && current.roleCode) {
        return current;
      }

      return {
        ...current,
        orgUnitCode: current.orgUnitCode || adminCatalog.orgUnits[0]?.code || "",
        roleCode: current.roleCode || adminCatalog.roles[0]?.code || "",
      };
    });

    setOrgForm((current) => {
      if (!current.id) {
        return current;
      }

      const matchedOrgUnit = adminCatalog.orgUnits.find((orgUnit) => orgUnit.id === current.id);
      return matchedOrgUnit
        ? createOrgFormFromRecord(matchedOrgUnit, adminCatalog)
        : createEmptyOrgForm();
    });

    setRoleForm((current) => {
      if (!current.id) {
        return current;
      }

      const matchedRole = adminCatalog.roles.find((role) => role.id === current.id);
      return matchedRole ? createRoleFormFromRecord(matchedRole) : createEmptyRoleForm();
    });

    setPolicyForm((current) => {
      if (!current.id) {
        return current;
      }

      const matchedPolicy = adminCatalog.policies.find((policy) => policy.id === current.id);
      return matchedPolicy
        ? createPolicyFormFromRecord(matchedPolicy)
        : createEmptyPolicyForm();
    });
  }, [adminCatalog]);

  const openDetailDialog = () => setDialogMode("detail");
  const closeDialog = () => setDialogMode(null);

  async function refreshAdminCatalog() {
    const response = await fetch("/api/admin/catalog", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("관리자 카탈로그를 새로고침하지 못했습니다.");
    }

    const payload = (await response.json()) as AdminCatalogApiPayload;

    if (!payload.catalog) {
      throw new Error("관리자 카탈로그 응답이 비어 있습니다.");
    }

    setAdminCatalog(payload.catalog);
    setAuditLogs(payload.auditLogs ?? []);
    setCatalogSource(payload.source === "database" ? "database" : "empty");
    setCatalogError(payload.error ?? null);

    return payload.catalog;
  }

  function resetUserForm() {
    setUserForm(createEmptyUserForm(adminCatalog));
  }

  function selectUserForEdit(user: AdminUserRecord) {
    setUserForm(createUserFormFromRecord(user));
  }

  function openNewUserDrawer() {
    resetUserForm();
    setUserDrawerOpen(true);
  }

  function openUserDrawerForEdit(user: AdminUserRecord) {
    selectUserForEdit(user);
    setUserDrawerOpen(true);
  }

  function toggleUserProjectAssignment(projectId: string) {
    setUserForm((current) => {
      const exists = current.projectAssignments.some(
        (assignment) => assignment.projectId === projectId,
      );
      const nextAssignments = exists
        ? current.projectAssignments.filter(
            (assignment) => assignment.projectId !== projectId,
          )
        : [...current.projectAssignments, { projectId }];
      const nextDefaultProjectId =
        current.defaultProjectId === projectId
          ? nextAssignments[0]?.projectId ?? ""
          : current.defaultProjectId || nextAssignments[0]?.projectId || "";

      return {
        ...current,
        projectAssignments: nextAssignments,
        defaultProjectId: nextDefaultProjectId,
      };
    });
  }

  function selectUserDefaultProject(projectId: string) {
    setUserForm((current) => ({
      ...current,
      defaultProjectId: projectId,
    }));
  }

  function resetOrgForm() {
    setOrgForm(createEmptyOrgForm());
    setOrgLeadSearch("");
  }

  function selectOrgForEdit(orgUnit: AdminOrgRecord) {
    setOrgForm(createOrgFormFromRecord(orgUnit, adminCatalog));
    setOrgLeadSearch("");
  }

  function openNewOrgDrawer() {
    resetOrgForm();
    setOrgDrawerOpen(true);
  }

  function openOrgDrawerForEdit(orgUnit: AdminOrgRecord) {
    selectOrgForEdit(orgUnit);
    setOrgDrawerOpen(true);
  }

  function setOrgMemberMoveTarget(userId: string, orgUnitCode: string) {
    setOrgMemberMoveTargets((current) => ({
      ...current,
      [userId]: orgUnitCode,
    }));
  }

  function resetRoleForm() {
    setRoleForm(createEmptyRoleForm());
  }

  function selectRoleForEdit(role: AdminRoleRecord) {
    setRoleForm(createRoleFormFromRecord(role));
  }

  function openNewRoleDrawer() {
    resetRoleForm();
    setRoleDrawerOpen(true);
  }

  function openRoleDrawerForEdit(role: AdminRoleRecord) {
    selectRoleForEdit(role);
    setRoleDrawerOpen(true);
  }

  function resetPolicyForm() {
    setPolicyForm(createEmptyPolicyForm());
  }

  function selectPolicyForEdit(policy: AdminPolicyRecord) {
    setPolicyForm(createPolicyFormFromRecord(policy));
  }

  function openNewPolicyDrawer() {
    resetPolicyForm();
    setPolicyDrawerOpen(true);
  }

  function openPolicyDrawerForEdit(policy: AdminPolicyRecord) {
    selectPolicyForEdit(policy);
    setPolicyDrawerOpen(true);
  }

  async function handleUserProvision() {
    if (!userForm.name || !userForm.email || !userForm.orgUnitCode || !userForm.roleCode) {
      pushToast({
        title: "필수 입력",
        description: "이름, 이메일, 조직, 역할을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setIsUserSaving(true);

    try {
      const endpoint = userForm.id ? `/api/admin/users/${userForm.id}` : "/api/admin/users";
      const method = userForm.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildUserProvisionPayload(userForm)),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          user?: AdminUserRecord;
        };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "사용자 권한 저장에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextUser = payload.data?.user
        ? nextCatalog.users.find((user) => user.id === payload.data?.user?.id) ?? payload.data.user
        : null;

      setUserForm(nextUser ? createUserFormFromRecord(nextUser) : createEmptyUserForm(nextCatalog));
      setUserDrawerOpen(false);
      pushToast({
        title: userForm.id ? "사용자 변경 반영" : "사용자 등록 완료",
        description: `${userForm.email} 계정의 접근 권한이 저장되었습니다.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "사용자 저장 실패",
        description: error instanceof Error ? error.message : "네트워크 상태를 확인해 주세요.",
        tone: "warning",
      });
    } finally {
      setIsUserSaving(false);
    }
  }

  async function handleUserStateToggle(user: AdminUserRecord) {
    setIsUserSaving(true);

    try {
      const nextState =
        user.state === "잠금" || user.state === "비활성" ? "활성" : "비활성";
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          orgUnitCode: user.orgUnitCode,
          roleCode: user.roleCode,
          state: nextState,
          defaultProjectId: user.defaultProjectId,
          projectAssignments: user.projectAssignments.map((assignment) => ({
            projectId: assignment.projectId,
          })),
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "상태 변경에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextUser = nextCatalog.users.find((entry) => entry.id === user.id);
      if (nextUser) {
        setUserForm((current) =>
          current.id === nextUser.id ? createUserFormFromRecord(nextUser) : current,
        );
      }
      pushToast({
        title: nextState === "비활성" ? "계정 비활성" : "계정 재활성",
        description: `${user.email} 계정 상태를 ${nextState}(으)로 변경했습니다.`,
        tone: nextState === "비활성" ? "warning" : "success",
      });
    } catch (error) {
      pushToast({
        title: "상태 변경 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setIsUserSaving(false);
    }
  }

  async function handleOrgProvision() {
    if (!orgForm.name || !orgForm.leadUserId) {
      pushToast({
        title: "필수 입력",
        description: "조직명과 책임자를 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    setMetaSavingTarget("orgs");

    try {
      const endpoint = orgForm.id ? `/api/admin/org-units/${orgForm.id}` : "/api/admin/org-units";
      const method = orgForm.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: orgForm.code,
          name: orgForm.name,
          category: orgForm.category,
          leadUserId: orgForm.leadUserId,
          state: orgForm.state,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          orgUnit?: AdminOrgRecord;
        };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "조직 저장에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextOrgUnit = payload.data?.orgUnit
        ? nextCatalog.orgUnits.find((orgUnit) => orgUnit.id === payload.data?.orgUnit?.id) ??
          payload.data.orgUnit
        : null;

      setOrgForm(
        nextOrgUnit ? createOrgFormFromRecord(nextOrgUnit, nextCatalog) : createEmptyOrgForm(),
      );
      setOrgDrawerOpen(false);
      pushToast({
        title: orgForm.id ? "조직 변경 반영" : "조직 등록 완료",
        description: `${orgForm.name} 조직 정보가 저장되었습니다.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "조직 저장 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  async function handleOrgStateToggle(orgUnit: AdminOrgRecord) {
    setMetaSavingTarget("orgs");

    try {
      const nextState = orgUnit.state === "비활성" ? "활성" : "비활성";
      const response = await fetch(`/api/admin/org-units/${orgUnit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: orgUnit.code,
          name: orgUnit.name,
          category: orgUnit.category,
          leadUserId: orgUnit.leadUserId,
          state: nextState,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "조직 상태 변경에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextOrgUnit = nextCatalog.orgUnits.find((entry) => entry.id === orgUnit.id);
      if (nextOrgUnit) {
        setOrgForm((current) =>
          current.id === nextOrgUnit.id
            ? createOrgFormFromRecord(nextOrgUnit, nextCatalog)
            : current,
        );
      }
      pushToast({
        title: nextState === "비활성" ? "조직 비활성" : "조직 재활성",
        description: `${orgUnit.name} 조직 상태를 ${nextState}(으)로 변경했습니다.`,
        tone: nextState === "비활성" ? "warning" : "success",
      });
    } catch (error) {
      pushToast({
        title: "조직 상태 변경 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  async function reassignOrgMember(user: AdminUserRecord, nextOrgUnitCode: string) {
    if (!nextOrgUnitCode) {
      pushToast({
        title: "이동 대상 필요",
        description: "이동할 조직을 먼저 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (user.orgUnitCode === nextOrgUnitCode) {
      return;
    }

    if (catalogSource === "empty") {
      pushToast({
        title: "실데이터 연결 필요",
        description: "조직 카탈로그가 비어 있어 멤버 배치와 조직 이동을 진행할 수 없습니다.",
        tone: "warning",
      });
      return;
    }

    if (
      lockedLeadUserIds.includes(user.id) &&
      user.orgUnitCode === activeOrgCode &&
      nextOrgUnitCode !== activeOrgCode
    ) {
      pushToast({
        title: "책임자 이동 제한",
        description: "현재 책임자는 다른 사용자로 책임자를 저장한 뒤 이동할 수 있습니다.",
        tone: "warning",
      });
      return;
    }

    const nextOrgUnit = adminCatalog.orgUnits.find((orgUnit) => orgUnit.code === nextOrgUnitCode);
    if (!nextOrgUnit) {
      pushToast({
        title: "조직 조회 실패",
        description: "이동할 조직을 다시 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    setOrgMemberSavingUserId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildUserProvisionPayloadFromRecord(user, {
            orgUnitCode: nextOrgUnitCode,
          }),
        ),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "조직 이동에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextUser = nextCatalog.users.find((entry) => entry.id === user.id);
      if (nextUser) {
        setUserForm((current) =>
          current.id === nextUser.id ? createUserFormFromRecord(nextUser) : current,
        );
      }

      setOrgMemberMoveTargets((current) => {
        const nextTargets = { ...current };
        delete nextTargets[user.id];
        return nextTargets;
      });
      setOrgMemberSearch("");
      pushToast({
        title: "조직 배치 반영",
        description: `${user.name} 사용자를 ${nextOrgUnit.name} 조직으로 이동했습니다.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "조직 이동 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setOrgMemberSavingUserId(null);
    }
  }

  async function handleRoleProvision() {
    if (!roleForm.code || !roleForm.name || !roleForm.permissionsText.trim()) {
      pushToast({
        title: "필수 입력",
        description: "역할코드, 역할명, 권한 코드를 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setMetaSavingTarget("roles");

    try {
      const endpoint = roleForm.id ? `/api/admin/roles/${roleForm.id}` : "/api/admin/roles";
      const method = roleForm.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: roleForm.code,
          name: roleForm.name,
          scope: roleForm.scope,
          permissions: roleForm.permissionsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          state: roleForm.state,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          role?: AdminRoleRecord;
        };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "역할 저장에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextRole = payload.data?.role
        ? nextCatalog.roles.find((role) => role.id === payload.data?.role?.id) ?? payload.data.role
        : null;

      setRoleForm(nextRole ? createRoleFormFromRecord(nextRole) : createEmptyRoleForm());
      setRoleDrawerOpen(false);
      pushToast({
        title: roleForm.id ? "역할 변경 반영" : "역할 등록 완료",
        description: `${roleForm.name} 역할 정보가 저장되었습니다.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "역할 저장 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  async function handleRoleStateToggle(role: AdminRoleRecord) {
    setMetaSavingTarget("roles");

    try {
      const nextState = role.state === "비활성" ? "활성" : "비활성";
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: role.code,
          name: role.name,
          scope: role.scope,
          permissions: role.permissions,
          state: nextState,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "역할 상태 변경에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextRole = nextCatalog.roles.find((entry) => entry.id === role.id);
      if (nextRole) {
        setRoleForm((current) =>
          current.id === nextRole.id ? createRoleFormFromRecord(nextRole) : current,
        );
      }
      pushToast({
        title: nextState === "비활성" ? "역할 비활성" : "역할 재활성",
        description: `${role.name} 역할 상태를 ${nextState}(으)로 변경했습니다.`,
        tone: nextState === "비활성" ? "warning" : "success",
      });
    } catch (error) {
      pushToast({
        title: "역할 상태 변경 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  async function handlePolicyProvision() {
    if (!policyForm.code || !policyForm.name || !policyForm.target || !policyForm.ruleSummary) {
      pushToast({
        title: "필수 입력",
        description: "정책코드, 정책명, 적용 대상, 규칙 요약을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setMetaSavingTarget("policies");

    try {
      const endpoint = policyForm.id ? `/api/admin/policies/${policyForm.id}` : "/api/admin/policies";
      const method = policyForm.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: policyForm.code,
          name: policyForm.name,
          target: policyForm.target,
          ruleSummary: policyForm.ruleSummary,
          state: policyForm.state,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          policy?: AdminPolicyRecord;
        };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "정책 저장에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextPolicy = payload.data?.policy
        ? nextCatalog.policies.find((policy) => policy.id === payload.data?.policy?.id) ??
          payload.data.policy
        : null;

      setPolicyForm(nextPolicy ? createPolicyFormFromRecord(nextPolicy) : createEmptyPolicyForm());
      setPolicyDrawerOpen(false);
      pushToast({
        title: policyForm.id ? "정책 변경 반영" : "정책 등록 완료",
        description: `${policyForm.name} 정책 정보가 저장되었습니다.`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "정책 저장 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  async function handlePolicyStateToggle(policy: AdminPolicyRecord) {
    setMetaSavingTarget("policies");

    try {
      const nextState = policy.state === "비활성" ? "활성" : "비활성";
      const response = await fetch(`/api/admin/policies/${policy.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: policy.code,
          name: policy.name,
          target: policy.target,
          ruleSummary: policy.ruleSummary,
          state: nextState,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "정책 상태 변경에 실패했습니다.");
      }

      const nextCatalog = await refreshAdminCatalog();
      const nextPolicy = nextCatalog.policies.find((entry) => entry.id === policy.id);
      if (nextPolicy) {
        setPolicyForm((current) =>
          current.id === nextPolicy.id ? createPolicyFormFromRecord(nextPolicy) : current,
        );
      }
      pushToast({
        title: nextState === "비활성" ? "정책 비활성" : "정책 재활성",
        description: `${policy.name} 정책 상태를 ${nextState}(으)로 변경했습니다.`,
        tone: nextState === "비활성" ? "warning" : "success",
      });
    } catch (error) {
      pushToast({
        title: "정책 상태 변경 실패",
        description: error instanceof Error ? error.message : "다시 시도해 주세요.",
        tone: "warning",
      });
    } finally {
      setMetaSavingTarget(null);
    }
  }

  const tabItems: TabItem[] = [
    {
      value: "users",
      label: "사용자",
      count: adminCatalog.users.length,
      caption: "SSO 사용자, 조직, 역할 상태",
    },
    {
      value: "orgs",
      label: "조직",
      count: adminCatalog.orgUnits.length,
      caption: "운영/프로젝트 조직 구조",
    },
    {
      value: "roles",
      label: "역할",
      count: adminCatalog.roles.length,
      caption: "권한 묶음과 접근 범위",
    },
    {
      value: "policies",
      label: "정책",
      count: adminCatalog.policies.length,
      caption: "세션, 보안, 직무분리 규칙",
    },
  ];

  const statusOptions = [
    { value: "all", label: "전체 상태" },
    { value: "활성", label: "활성" },
    { value: "검토중", label: "검토중" },
    { value: "비활성", label: "비활성" },
    { value: "잠금", label: "잠금" },
    { value: "설계중", label: "설계중" },
  ];

  const firstFilterConfig =
    activeTab === "users"
      ? {
          key: "first",
          label: "조직",
          options: [
            { value: "all", label: "전체 조직" },
            ...adminCatalog.orgUnits.map((orgUnit) => ({
              value: orgUnit.code,
              label: orgUnit.name,
            })),
          ],
        }
      : activeTab === "orgs"
        ? {
            key: "first",
            label: "분류",
            options: [
              { value: "all", label: "전체 분류" },
              { value: "프로젝트", label: "프로젝트" },
              { value: "운영", label: "운영" },
              { value: "플랫폼", label: "플랫폼" },
            ],
          }
        : activeTab === "roles"
          ? {
              key: "first",
              label: "범위",
              options: [
                { value: "all", label: "전체 범위" },
                { value: "공통", label: "공통" },
                { value: "프로젝트", label: "프로젝트" },
                { value: "품질", label: "품질" },
                { value: "재무", label: "재무" },
              ],
            }
          : {
              key: "first",
              label: "대상",
              options: [
                { value: "all", label: "전체 대상" },
                { value: "전체 사용자", label: "전체 사용자" },
                { value: "재무 역할", label: "재무 역할" },
                { value: "문서/협업", label: "문서/협업" },
              ],
            };

  const secondFilterConfig =
    activeTab === "users"
      ? {
          key: "second",
          label: "상태",
          options: statusOptions.filter((option) =>
            ["all", "활성", "검토중", "비활성", "잠금"].includes(option.value),
          ),
        }
      : activeTab === "orgs"
        ? {
            key: "second",
            label: "상태",
            options: statusOptions.filter((option) =>
              ["all", "활성", "설계중", "비활성"].includes(option.value),
            ),
          }
        : activeTab === "roles"
          ? {
              key: "second",
              label: "상태",
              options: statusOptions.filter((option) =>
                ["all", "활성", "검토중", "비활성"].includes(option.value),
              ),
            }
          : {
              key: "second",
              label: "상태",
              options: statusOptions.filter((option) =>
                ["all", "활성", "검토중", "비활성"].includes(option.value),
              ),
            };

  const filteredUsers = adminCatalog.users.filter((user) => {
    if (firstFilter !== "all" && user.orgUnitCode !== firstFilter) {
      return false;
    }

    if (secondFilter !== "all" && user.state !== secondFilter) {
      return false;
    }

    return includesSearch(
      [
        user.name,
        user.email,
        user.orgUnitName,
        user.roleName,
        user.employeeNo,
        ...user.projectAssignments.map((assignment) => assignment.projectName),
      ],
      deferredSearch,
    );
  });

  const filteredOrgUnits = adminCatalog.orgUnits.filter((orgUnit) => {
    if (firstFilter !== "all" && orgUnit.category !== firstFilter) {
      return false;
    }

    if (secondFilter !== "all" && orgUnit.state !== secondFilter) {
      return false;
    }

    return includesSearch(
      [orgUnit.name, orgUnit.code, orgUnit.leadName, orgUnit.category],
      deferredSearch,
    );
  });

  const filteredRoles = adminCatalog.roles.filter((role) => {
    if (firstFilter !== "all" && role.scope !== firstFilter) {
      return false;
    }

    if (secondFilter !== "all" && role.state !== secondFilter) {
      return false;
    }

    return includesSearch(
      [role.name, role.code, role.scope, role.permissions.join(" ")],
      deferredSearch,
    );
  });

  const filteredPolicies = adminCatalog.policies.filter((policy) => {
    if (firstFilter !== "all" && policy.target !== firstFilter) {
      return false;
    }

    if (secondFilter !== "all" && policy.state !== secondFilter) {
      return false;
    }

    return includesSearch(
      [policy.name, policy.code, policy.target, policy.ruleSummary],
      deferredSearch,
    );
  });

  const recentAuditLogs = auditLogs.slice().reverse().slice(0, 5);

  const selectedOrgLeadUser =
    adminCatalog.users.find((user) => user.id === orgForm.leadUserId) ?? null;
  const editingOrgUnit =
    (orgForm.id
      ? adminCatalog.orgUnits.find((orgUnit) => orgUnit.id === orgForm.id)
      : null) ?? null;
  const persistedOrgForm = editingOrgUnit
    ? createOrgFormFromRecord(editingOrgUnit, adminCatalog)
    : null;
  const orgMembershipLockReason = !editingOrgUnit
    ? "조직을 먼저 저장하면 소속 사용자 배치와 이동을 시작할 수 있습니다."
    : persistedOrgForm &&
        (persistedOrgForm.code !== orgForm.code ||
          persistedOrgForm.name !== orgForm.name ||
          persistedOrgForm.category !== orgForm.category ||
          persistedOrgForm.state !== orgForm.state ||
          persistedOrgForm.leadUserId !== orgForm.leadUserId)
      ? "조직 기본정보를 먼저 저장해야 소속 사용자 배치와 이동을 진행할 수 있습니다."
      : null;
  const activeOrgCode = editingOrgUnit?.code ?? "";
  const lockedLeadUserIds = Array.from(
    new Set(
      [editingOrgUnit?.leadUserId, orgForm.leadUserId].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
  const currentOrgMembers = activeOrgCode
    ? adminCatalog.users
        .filter((user) => user.orgUnitCode === activeOrgCode)
        .slice()
        .sort((left, right) => {
          const leftLead = lockedLeadUserIds.includes(left.id) ? 1 : 0;
          const rightLead = lockedLeadUserIds.includes(right.id) ? 1 : 0;

          if (leftLead !== rightLead) {
            return rightLead - leftLead;
          }

          return left.name.localeCompare(right.name, "ko");
        })
    : [];
  const assignableOrgUsers =
    !orgMembershipLockReason && deferredOrgMemberSearch.trim()
      ? adminCatalog.users
          .filter((user) => user.orgUnitCode !== activeOrgCode)
          .filter((user) =>
            includesSearch(
              [
                user.name,
                user.email,
                user.employeeNo,
                user.orgUnitName,
                user.roleName,
              ],
              deferredOrgMemberSearch,
            ),
          )
          .slice(0, 8)
      : [];
  const orgMoveOptions = adminCatalog.orgUnits
    .filter(
      (orgUnit) => orgUnit.code !== activeOrgCode && orgUnit.state !== "비활성",
    )
    .map((orgUnit) => ({
      label: `${orgUnit.name} (${orgUnit.code})`,
      value: orgUnit.code,
    }));

  const filteredOrgLeadUsers = adminCatalog.users
    .filter((user) => user.state !== "잠금")
    .filter((user) => {
      if (!deferredLeadSearch.trim()) {
        return selectedOrgLeadUser ? user.id === selectedOrgLeadUser.id : false;
      }

      return includesSearch(
        [user.name, user.email, user.employeeNo, user.orgUnitName, user.roleName],
        deferredLeadSearch,
      );
    })
    .slice(0, 8);

  const selectedRolePermissions = parsePermissionCodes(roleForm.permissionsText);
  const selectedRolePermissionSet = new Set(selectedRolePermissions);

  function toggleRolePermission(permission: string) {
    setRoleForm((current) => {
      const currentCodes = parsePermissionCodes(current.permissionsText);
      const nextCodes = currentCodes.includes(permission)
        ? currentCodes.filter((code) => code !== permission)
        : [...currentCodes, permission];

      return {
        ...current,
        permissionsText: serializePermissionCodes(nextCodes),
      };
    });
  }

  function clearRolePermissions() {
    setRoleForm((current) => ({
      ...current,
      permissionsText: "",
    }));
  }

  const summaryItems = [
    {
      label: "활성 사용자",
      value: `${formatIntegerDisplay(adminCatalog.users.filter((user) => user.state === "활성").length)}명`,
      caption: "Google SSO 연결 대상",
    },
    {
      label: "역할 템플릿",
      value: `${formatIntegerDisplay(adminCatalog.roles.length)}개`,
      caption: "공통 + 도메인 권한 묶음",
    },
    {
      label: "운영 조직",
      value: `${formatIntegerDisplay(adminCatalog.orgUnits.length)}개`,
      caption: "기본 조직과 책임자 기준",
    },
    {
      label: "감사 이벤트",
      value: `${formatIntegerDisplay(auditLogs.length)}건`,
      caption: "관리자 이벤트 읽기 전용 로그",
    },
  ];

  useEffect(() => {
    setOrgMemberSearch("");
    setOrgMemberMoveTargets({});
  }, [orgDrawerOpen, orgForm.id]);

  const activeCount =
    activeTab === "users"
      ? filteredUsers.length
      : activeTab === "orgs"
        ? filteredOrgUnits.length
        : activeTab === "roles"
          ? filteredRoles.length
          : filteredPolicies.length;

  const tableConfig =
    activeTab === "users"
      ? {
          title: "사용자 리스트",
          description: "기본 조직과 프로젝트 접근 범위를 유지하면서 사용자 리스트를 더 넓게 확인할 수 있습니다.",
          columns: [
            { key: "name", label: "사용자" },
            { key: "org", label: "조직" },
            { key: "recent", label: "최근 로그인" },
            { key: "state", label: "상태" },
            { key: "actions", label: "작업" },
          ],
          rows: filteredUsers.map((user) => ({
            id: user.id,
            name: (
              <div>
                <div className="font-medium text-[color:var(--text)]">{user.name}</div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {user.employeeNo}
                </div>
              </div>
            ),
            org: (
              <div>
                <div className="font-medium">{user.orgUnitName}</div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {user.projectAssignments.find(
                    (assignment) => assignment.projectId === user.defaultProjectId,
                  )?.projectName ?? "기본 프로젝트 없음"}
                </div>
              </div>
            ),
            recent: (
              <div>
                <div className="font-medium">{user.provider}</div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  최근 접속 {user.lastSeenAt}
                </div>
              </div>
            ),
            state: getStatusBadge(user.state as keyof typeof stateToneMap),
            actions: (
              <div
                className="flex flex-wrap justify-end gap-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <PermissionButton
                  type="button"
                  permission="admin.user.update"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    user.state === "잠금" || user.state === "비활성"
                      ? "border-[color:var(--success)] bg-[rgba(54,179,126,0.08)] text-[color:var(--success)]"
                      : "border-[color:var(--warning)] bg-[rgba(255,171,0,0.12)] text-[color:var(--warning)]"
                  }`}
                  onClick={() => void handleUserStateToggle(user)}
                  disabled={catalogSource === "empty" || isUserSaving}
                >
                  {user.state === "잠금" || user.state === "비활성" ? "재활성" : "비활성"}
                </PermissionButton>
              </div>
            ),
          })),
        }
      : activeTab === "orgs"
        ? {
            title: "조직 구조",
            description: "사용자 기본 조직과 메뉴 기준을 결정하는 운영 마스터입니다.",
            columns: [
              { key: "name", label: "조직" },
              { key: "category", label: "분류" },
              { key: "lead", label: "책임자" },
              { key: "members", label: "인원", align: "right" as const },
              { key: "state", label: "상태" },
              { key: "actions", label: "작업" },
            ],
            rows: filteredOrgUnits.map((orgUnit) => ({
              id: orgUnit.id,
              name: (
                <div>
                  <div className="font-medium">{orgUnit.name}</div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {orgUnit.code}
                  </div>
                </div>
              ),
              category: orgUnit.category,
              lead: (
                <div>
                  <div className="font-medium">{orgUnit.leadName}</div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {orgUnit.leadEmail || "users 컬렉션 기준"}
                  </div>
                </div>
              ),
              members: formatIntegerDisplay(orgUnit.memberCount),
              state: getStatusBadge(orgUnit.state as keyof typeof stateToneMap),
              actions: (
                <div
                  className="flex flex-wrap justify-end gap-2"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                    <PermissionButton
                      type="button"
                      permission="admin.org.update"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        orgUnit.state === "비활성"
                          ? "border-[color:var(--success)] bg-[rgba(54,179,126,0.08)] text-[color:var(--success)]"
                          : "border-[color:var(--warning)] bg-[rgba(255,171,0,0.12)] text-[color:var(--warning)]"
                      }`}
                      onClick={() => void handleOrgStateToggle(orgUnit)}
                      disabled={metaSavingTarget !== null}
                    >
                      {orgUnit.state === "비활성" ? "재활성" : "비활성"}
                    </PermissionButton>
                  </div>
                ),
            })),
          }
        : activeTab === "roles"
          ? {
              title: "역할 템플릿",
              description: "기본 역할은 사용자 권한과 메뉴 접근 범위를 묶는 운영 마스터입니다.",
              columns: [
                { key: "name", label: "역할" },
                { key: "scope", label: "범위" },
                { key: "permissions", label: "권한 묶음" },
                { key: "members", label: "배정", align: "right" as const },
                { key: "state", label: "상태" },
                { key: "actions", label: "작업" },
              ],
              rows: filteredRoles.map((role) => ({
                id: role.id,
                name: (
                  <div>
                    <div className="font-medium">{role.name}</div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {role.code}
                    </div>
                  </div>
                ),
                scope: role.scope,
                permissions: (
                  <div
                    className="max-w-[18rem]"
                    title={role.permissions
                      .map((permission) => {
                        const metadata = getPermissionDisplay(permission);
                        return `${metadata.label} (${permission})`;
                      })
                      .join(", ")}
                  >
                    <div className="flex flex-wrap gap-2">
                      {role.permissions
                        .slice(0, rolePermissionPreviewCount)
                        .map((permission) => {
                          const metadata = getPermissionDisplay(permission);

                          return (
                            <div
                              key={permission}
                              className="rounded-full border border-[rgba(12,102,228,0.12)] bg-[rgba(12,102,228,0.05)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
                            >
                              {metadata.label}
                            </div>
                          );
                        })}
                      {role.permissions.length > rolePermissionPreviewCount ? (
                        <div className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)]">
                          +{formatIntegerDisplay(
                            role.permissions.length - rolePermissionPreviewCount,
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                      총 {formatIntegerDisplay(role.permissions.length)}개 권한
                    </div>
                  </div>
                ),
                members: formatIntegerDisplay(role.memberCount),
                state: getStatusBadge(role.state as keyof typeof stateToneMap),
                actions: (
                  <div
                    className="flex flex-wrap justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <PermissionButton
                      type="button"
                      permission="admin.role.update"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        role.state === "비활성"
                          ? "border-[color:var(--success)] bg-[rgba(54,179,126,0.08)] text-[color:var(--success)]"
                          : "border-[color:var(--warning)] bg-[rgba(255,171,0,0.12)] text-[color:var(--warning)]"
                      }`}
                      onClick={() => void handleRoleStateToggle(role)}
                      disabled={metaSavingTarget !== null}
                    >
                      {role.state === "비활성" ? "재활성" : "비활성"}
                    </PermissionButton>
                  </div>
                ),
              })),
            }
          : {
              title: "정책 규칙",
              description: "정책은 세션, 보안, 직무분리 규칙을 활성/비활성 상태로 운영합니다.",
              columns: [
                { key: "name", label: "정책" },
                { key: "target", label: "대상" },
                { key: "rule", label: "규칙 요약" },
                { key: "state", label: "상태" },
                { key: "actions", label: "작업" },
              ],
              rows: filteredPolicies.map((policy) => ({
                id: policy.id,
                name: (
                  <div>
                    <div className="font-medium">{policy.name}</div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {policy.code}
                    </div>
                  </div>
                ),
                target: policy.target,
                rule: policy.ruleSummary,
                state: getStatusBadge(policy.state as keyof typeof stateToneMap),
                actions: (
                  <div
                    className="flex flex-wrap justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <PermissionButton
                      type="button"
                      permission="admin.policy.update"
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        policy.state === "비활성"
                          ? "border-[color:var(--success)] bg-[rgba(54,179,126,0.08)] text-[color:var(--success)]"
                          : "border-[color:var(--warning)] bg-[rgba(255,171,0,0.12)] text-[color:var(--warning)]"
                      }`}
                      onClick={() => void handlePolicyStateToggle(policy)}
                      disabled={metaSavingTarget !== null}
                    >
                      {policy.state === "비활성" ? "재활성" : "비활성"}
                    </PermissionButton>
                  </div>
                ),
              })),
            };

  const searchPlaceholder = "이름, 코드, 이메일, 규칙 키워드 검색";

  const headerActions = isProvisionTab ? (
    <>
      <button
        type="button"
        className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
        onClick={openDetailDialog}
      >
        기준 상세
      </button>
      <PermissionButton
        type="button"
        permission={
          activeTab === "users"
            ? "admin.user.create"
            : activeTab === "orgs"
              ? "admin.org.create"
              : activeTab === "roles"
                ? "admin.role.create"
                : "admin.policy.create"
        }
        className={`${adminButtonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)]`}
        onClick={
          activeTab === "users"
            ? openNewUserDrawer
            : activeTab === "orgs"
              ? openNewOrgDrawer
              : activeTab === "roles"
                ? openNewRoleDrawer
                : openNewPolicyDrawer
        }
      >
        {activeTab === "users"
          ? "새 사용자"
          : activeTab === "orgs"
            ? "새 조직"
            : activeTab === "roles"
              ? "새 역할"
              : "새 정책"}
      </PermissionButton>
    </>
  ) : null;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="사용자, 조직, 역할, 정책 운영 기준"
        description="Google 로그인은 인증만 맡기고, 실제 사용자 허용과 역할 부여는 관리자 화면에서 users 컬렉션 기준으로 운영합니다."
        actions={headerActions}
      />

      <AdminSummaryCards items={summaryItems} />

      <Tabs
        items={tabItems}
        value={activeTab}
        onChange={(value) =>
          startTransition(() => {
            setActiveTab(value as AdminTabValue);
            setSearchValue("");
            setFirstFilter("all");
            setSecondFilter("all");
            setDialogMode(null);
            setUserDrawerOpen(false);
            setOrgDrawerOpen(false);
            setRoleDrawerOpen(false);
            setPolicyDrawerOpen(false);
          })
        }
      />

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={searchPlaceholder}
        filters={[
          {
            ...firstFilterConfig,
            value: firstFilter,
          },
          {
            ...secondFilterConfig,
            value: secondFilter,
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === "first") {
            setFirstFilter(value);
            return;
          }

          setSecondFilter(value);
        }}
        summary={`${formatIntegerDisplay(activeCount)}건 표시`}
        actions={
          <>
            <button
              type="button"
              className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
              onClick={() => {
                setSearchValue("");
                setFirstFilter("all");
                setSecondFilter("all");
              }}
            >
              필터 초기화
            </button>
            {isProvisionTab ? (
              <button
                type="button"
                className={`${adminButtonClassName} border-[color:var(--primary)] bg-[color:var(--selected)] text-[color:var(--primary)] hover:border-[color:var(--primary)]`}
                onClick={openDetailDialog}
              >
                템플릿 보기
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6">
        <DataTable
          title={tableConfig.title}
          description={tableConfig.description}
          columns={tableConfig.columns}
          rows={tableConfig.rows}
          getRowKey={(row) => String(row.id)}
          onRowClick={
            canUpdateActiveTab
              ? (_, index) =>
                  activeTab === "users"
                    ? openUserDrawerForEdit(filteredUsers[index])
                    : activeTab === "orgs"
                      ? openOrgDrawerForEdit(filteredOrgUnits[index])
                      : activeTab === "roles"
                        ? openRoleDrawerForEdit(filteredRoles[index])
                        : openPolicyDrawerForEdit(filteredPolicies[index])
              : undefined
          }
          getRowAriaLabel={
            canUpdateActiveTab
              ? (_, index) =>
                  activeTab === "users"
                    ? `${filteredUsers[index]?.name ?? "사용자"} 상세 열기`
                    : activeTab === "orgs"
                      ? `${filteredOrgUnits[index]?.name ?? "조직"} 상세 열기`
                      : activeTab === "roles"
                        ? `${filteredRoles[index]?.name ?? "역할"} 상세 열기`
                        : `${filteredPolicies[index]?.name ?? "정책"} 상세 열기`
              : undefined
          }
          emptyState={{
            title: "조건과 일치하는 관리 항목이 없습니다",
            description: "검색어와 필터를 초기화하면 기준선을 다시 확인할 수 있습니다.",
            action: (
              <button
                type="button"
                className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
                onClick={() => {
                  setSearchValue("");
                  setFirstFilter("all");
                  setSecondFilter("all");
                }}
              >
                필터 초기화
              </button>
            ),
          }}
        />

        <AdminAuditLogPanel auditLogs={recentAuditLogs} />
      </div>

      <Drawer
        open={activeTab === "users" && userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        eyebrow="사용자"
        title={userForm.id ? "사용자 편집" : "새 사용자"}
        description="이메일, 역할, 기본 프로젝트, 프로젝트 배정을 여기서 관리합니다."
      >
        <AdminUsersPanel
          adminCatalog={adminCatalog}
          userForm={userForm}
          projectOptionMap={projectOptionMap}
          catalogSource={catalogSource}
          catalogError={catalogError}
          isUserSaving={isUserSaving}
          withPanel={false}
          onNameChange={(value) =>
            setUserForm((current) => ({ ...current, name: value }))
          }
          onEmailChange={(value) =>
            setUserForm((current) => ({
              ...current,
              email: value.trim().toLowerCase(),
            }))
          }
          onStateChange={(value) =>
            setUserForm((current) => ({ ...current, state: value }))
          }
          onOrgUnitCodeChange={(value) =>
            setUserForm((current) => ({ ...current, orgUnitCode: value }))
          }
          onRoleCodeChange={(value) =>
            setUserForm((current) => ({ ...current, roleCode: value }))
          }
          onDefaultProjectChange={selectUserDefaultProject}
          onToggleProjectAssignment={toggleUserProjectAssignment}
          onReset={resetUserForm}
          onSubmit={() => void handleUserProvision()}
          canSubmit={userForm.id ? canUpdateUsers : canCreateUsers}
        />
      </Drawer>

      <Drawer
        open={activeTab === "orgs" && orgDrawerOpen}
        onClose={() => setOrgDrawerOpen(false)}
        eyebrow="조직"
        title={orgForm.id ? "조직 편집" : "새 조직"}
        description="조직코드, 분류, 책임자, 상태를 여기서 관리합니다."
      >
        <AdminOrgsPanel
          orgForm={orgForm}
          selectedOrgLeadUser={selectedOrgLeadUser}
          filteredOrgLeadUsers={filteredOrgLeadUsers}
          currentMembers={currentOrgMembers}
          assignableUsers={assignableOrgUsers}
          orgLeadSearch={orgLeadSearch}
          deferredLeadSearch={deferredLeadSearch}
          orgMemberSearch={orgMemberSearch}
          orgMoveOptions={orgMoveOptions}
          orgMemberMoveTargets={orgMemberMoveTargets}
          orgMemberSavingUserId={orgMemberSavingUserId}
          orgMembershipLockReason={orgMembershipLockReason}
          lockedLeadUserIds={lockedLeadUserIds}
          metaSavingTarget={metaSavingTarget}
          withPanel={false}
          onNameChange={(value) =>
            setOrgForm((current) => ({ ...current, name: value }))
          }
          onCategoryChange={(value) =>
            setOrgForm((current) => ({ ...current, category: value }))
          }
          onStateChange={(value) =>
            setOrgForm((current) => ({ ...current, state: value }))
          }
          onLeadSearchChange={setOrgLeadSearch}
          onOrgMemberSearchChange={setOrgMemberSearch}
          onLeadSelect={(userId) => {
            setOrgForm((current) => ({ ...current, leadUserId: userId }));
            setOrgLeadSearch("");
          }}
          onOrgMemberMoveTargetChange={setOrgMemberMoveTarget}
          onAssignMember={(user) => void reassignOrgMember(user, activeOrgCode)}
          onMoveMember={(user, orgUnitCode) => void reassignOrgMember(user, orgUnitCode)}
          onReset={resetOrgForm}
          onSubmit={() => void handleOrgProvision()}
          canSubmit={orgForm.id ? canUpdateOrgs : canCreateOrgs}
        />
      </Drawer>

      <Drawer
        open={activeTab === "roles" && roleDrawerOpen}
        onClose={() => setRoleDrawerOpen(false)}
        eyebrow="역할"
        title={roleForm.id ? "역할 편집" : "새 역할"}
        description="역할 템플릿과 권한 코드를 여기서 관리합니다."
      >
        <AdminRolesPanel
          roleForm={roleForm}
          selectedRolePermissions={selectedRolePermissions}
          selectedRolePermissionSet={selectedRolePermissionSet}
          metaSavingTarget={metaSavingTarget}
          withPanel={false}
          onCodeChange={(value) =>
            setRoleForm((current) => ({ ...current, code: value.toUpperCase() }))
          }
          onNameChange={(value) =>
            setRoleForm((current) => ({ ...current, name: value }))
          }
          onScopeChange={(value) =>
            setRoleForm((current) => ({ ...current, scope: value }))
          }
          onStateChange={(value) =>
            setRoleForm((current) => ({ ...current, state: value }))
          }
          onPermissionsTextChange={(value) =>
            setRoleForm((current) => ({ ...current, permissionsText: value }))
          }
          onTogglePermission={toggleRolePermission}
          onClearPermissions={clearRolePermissions}
          onReset={resetRoleForm}
          onSubmit={() => void handleRoleProvision()}
          canSubmit={roleForm.id ? canUpdateRoles : canCreateRoles}
        />
      </Drawer>

      <Drawer
        open={activeTab === "policies" && policyDrawerOpen}
        onClose={() => setPolicyDrawerOpen(false)}
        eyebrow="정책"
        title={policyForm.id ? "정책 편집" : "새 정책"}
        description="정책 규칙과 상태를 여기서 관리합니다."
      >
        <AdminPoliciesPanel
          policyForm={policyForm}
          metaSavingTarget={metaSavingTarget}
          withPanel={false}
          onCodeChange={(value) =>
            setPolicyForm((current) => ({ ...current, code: value.toUpperCase() }))
          }
          onNameChange={(value) =>
            setPolicyForm((current) => ({ ...current, name: value }))
          }
          onTargetChange={(value) =>
            setPolicyForm((current) => ({ ...current, target: value }))
          }
          onStateChange={(value) =>
            setPolicyForm((current) => ({ ...current, state: value }))
          }
          onRuleSummaryChange={(value) =>
            setPolicyForm((current) => ({ ...current, ruleSummary: value }))
          }
          onReset={resetPolicyForm}
          onSubmit={() => void handlePolicyProvision()}
          canSubmit={policyForm.id ? canUpdatePolicies : canCreatePolicies}
        />
      </Drawer>

      {isProvisionTab ? (
        <AdminDetailDialog
          open={dialogMode !== null}
          onClose={closeDialog}
          activeTab={activeTab as ProvisionAdminTabValue}
        />
      ) : null}
    </>
  );
}
