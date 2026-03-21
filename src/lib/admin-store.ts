import {
  emptyAdminCatalog,
  type AdminCatalog,
  type AdminOrgRecord,
  type AdminPolicyRecord,
  type AdminProjectOptionRecord,
  type AdminRoleRecord,
  type AdminUserRecord,
  type AdminUserProjectAssignmentRecord,
} from "@/lib/admin-catalog";
import { generateOrgUnitCode } from "@/lib/document-numbers";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import { allPermissionCatalog, type AppRole } from "@/lib/navigation";
import { getMongoDb, isMongoConfigured } from "@/lib/mongodb";

type AdminCatalogSource = "database" | "empty";
type MongoDb = Awaited<ReturnType<typeof getMongoDb>>;

type PersistedUserProjectAssignment = {
  projectId?: string;
  siteIds?: string[];
};

type AdminUserDoc = {
  _id?: { toString(): string } | string;
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  employeeNo?: string;
  orgUnitCode?: string;
  orgUnitName?: string;
  roleCode?: string;
  roleName?: string;
  provider?: string;
  state?: string;
  lastSeenAt?: string;
  defaultProjectId?: string;
  projectAssignments?: PersistedUserProjectAssignment[];
};

type AdminOrgDoc = Partial<AdminOrgRecord> & {
  _id?: { toString(): string } | string;
  leadUserId?: string;
  leadEmail?: string;
};

type AdminRoleDoc = Partial<AdminRoleRecord> & {
  _id?: { toString(): string } | string;
};

type AdminPolicyDoc = Partial<AdminPolicyRecord> & {
  _id?: { toString(): string } | string;
};

type AdminProjectDoc = {
  _id?: { toString(): string } | string;
  code?: string;
  name?: string;
  status?: string;
};

type AdminAuditLogDoc = {
  _id?: { toString(): string } | string;
  eventCode?: string;
  actor?: string;
  resource?: string;
  route?: string;
  ipAddress?: string;
  occurredAt?: string;
  result?: string;
  roles?: AppRole[];
};

export type AdminCatalogResult = {
  catalog: AdminCatalog;
  source: AdminCatalogSource;
  error?: string;
};

export type AdminAuthContext = {
  user: AdminUserRecord | null;
  role: AdminRoleRecord | null;
  orgUnit: AdminOrgRecord | null;
  policyCodes: string[];
  source: AdminCatalogSource;
};

export type AdminActorProfile = {
  displayName: string;
  orgUnitName: string;
  email: string;
};

export type AdminMutationContext = {
  actor: AdminActorProfile;
  route: string;
  ipAddress: string;
};

export type AdminUserProvisionInput = {
  name: string;
  email: string;
  orgUnitCode: string;
  roleCode: string;
  state: string;
  defaultProjectId?: string;
  projectAssignments?: Array<{
    projectId: string;
  }>;
};

export type AdminOrgProvisionInput = {
  code: string;
  name: string;
  category: string;
  leadUserId: string;
  state: string;
};

export type AdminRoleProvisionInput = {
  code: string;
  name: string;
  scope: string;
  permissions: string[];
  state: string;
};

export type AdminPolicyProvisionInput = {
  code: string;
  name: string;
  target: string;
  ruleSummary: string;
  state: string;
};

type AdminUserMutationResult = {
  action: "create" | "update";
  user: AdminUserRecord;
};

type AdminOrgMutationResult = {
  action: "create" | "update";
  orgUnit: AdminOrgRecord;
};

type AdminRoleMutationResult = {
  action: "create" | "update";
  role: AdminRoleRecord;
};

type AdminPolicyMutationResult = {
  action: "create" | "update";
  policy: AdminPolicyRecord;
};

type NormalizedUserProjectAssignment = {
  projectId: string;
  siteIds: string[];
};

class AdminStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const allowedUserStates = new Set(["활성", "검토중", "잠금", "비활성"]);
const allowedOrgStates = new Set(["활성", "설계중", "비활성"]);
const allowedRoleStates = new Set(["활성", "검토중", "비활성"]);
const allowedPolicyStates = new Set(["활성", "검토중", "비활성"]);
const allowedOrgCategories = new Set(["프로젝트", "운영", "플랫폼"]);
const allowedRoleScopes = new Set(["공통", "사업개발", "프로젝트", "공급망", "제작", "품질", "재무", "시운전"]);

function formatAuditOccurredAt(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function recordAdminAuditLog(input: {
  db: MongoDb;
  context: AdminMutationContext;
  eventCode: string;
  resource: string;
}) {
  const occurredAt = formatAuditOccurredAt(new Date());

  await input.db.collection<AdminAuditLogDoc>("auditLogs").insertOne({
    eventCode: input.eventCode,
    actor: input.context.actor.displayName || input.context.actor.email,
    resource: input.resource,
    route: input.context.route,
    ipAddress: input.context.ipAddress || "127.0.0.1",
    occurredAt,
    result: "success",
    roles: ["platform_admin"],
  });
}

function normalizeId(value: AdminUserDoc["_id"] | AdminOrgDoc["_id"] | AdminRoleDoc["_id"] | AdminPolicyDoc["_id"], fallback: string) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toString();
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeEmail(value: unknown) {
  return toTrimmedString(value).toLowerCase();
}

function normalizeUserState(value: unknown) {
  const state = toTrimmedString(value) || "활성";

  if (!allowedUserStates.has(state)) {
    throw new AdminStoreError("유효하지 않은 사용자 상태입니다.");
  }

  return state;
}

function normalizeOrgState(value: unknown) {
  const state = toTrimmedString(value) || "활성";

  if (!allowedOrgStates.has(state)) {
    throw new AdminStoreError("유효하지 않은 조직 상태입니다.");
  }

  return state;
}

function normalizeRoleState(value: unknown) {
  const state = toTrimmedString(value) || "활성";

  if (!allowedRoleStates.has(state)) {
    throw new AdminStoreError("유효하지 않은 역할 상태입니다.");
  }

  return state;
}

function normalizePolicyState(value: unknown) {
  const state = toTrimmedString(value) || "활성";

  if (!allowedPolicyStates.has(state)) {
    throw new AdminStoreError("유효하지 않은 정책 상태입니다.");
  }

  return state;
}

function normalizeOrgCategory(value: unknown) {
  const category = toTrimmedString(value);

  if (!allowedOrgCategories.has(category)) {
    throw new AdminStoreError("유효하지 않은 조직 분류입니다.");
  }

  return category;
}

function normalizeRoleScope(value: unknown) {
  const scope = toTrimmedString(value);

  if (!allowedRoleScopes.has(scope)) {
    throw new AdminStoreError("유효하지 않은 역할 범위입니다.");
  }

  return scope;
}

function parsePermissions(input: string[] | unknown) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const normalized = [...new Set(values.map((value) => toTrimmedString(value)).filter(Boolean))];
  const invalidPermissions = normalized.filter(
    (permission) => !allPermissionCatalog.includes(permission as (typeof allPermissionCatalog)[number]),
  );

  if (invalidPermissions.length > 0) {
    throw new AdminStoreError(`유효하지 않은 권한 코드입니다: ${invalidPermissions.join(", ")}`);
  }

  return normalized;
}

function normalizeProjectAssignments(
  values: AdminUserProvisionInput["projectAssignments"],
) {
  const assignments = Array.isArray(values) ? values : [];
  const assignmentSet = new Set<string>();

  for (const assignment of assignments) {
    const projectId = toTrimmedString(assignment?.projectId);

    if (!projectId) {
      continue;
    }

    assignmentSet.add(projectId);
  }

  return [...assignmentSet].map((projectId) => ({
    projectId,
    siteIds: [],
  })) satisfies NormalizedUserProjectAssignment[];
}

function extractEmployeeSequence(employeeNo: unknown) {
  const matchedSequence = toTrimmedString(employeeNo).match(/(\d+)$/);
  return matchedSequence ? Number(matchedSequence[1]) : 0;
}

async function getMaxEmployeeSequence(db: MongoDb) {
  const docs = await db
    .collection<Pick<AdminUserDoc, "employeeNo">>("users")
    .find({}, { projection: { employeeNo: 1 } })
    .toArray();

  return docs.reduce((maxValue, doc) => {
    const currentValue = extractEmployeeSequence(doc.employeeNo);
    return currentValue > maxValue ? currentValue : maxValue;
  }, 0);
}

async function generateNextEmployeeNo(db: MongoDb) {
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const maxExistingSequence = await getMaxEmployeeSequence(db);
  const employeeCounter = await counters.findOne({ _id: "employeeNo" });

  if (!employeeCounter || employeeCounter.seq < maxExistingSequence) {
    await counters.updateOne(
      { _id: "employeeNo" },
      { $set: { seq: maxExistingSequence } },
      { upsert: true },
    );
  }

  await counters.updateOne(
    { _id: "employeeNo" },
    { $inc: { seq: 1 } },
    { upsert: true },
  );

  const nextCounter = await counters.findOne({ _id: "employeeNo" });
  const nextSequence = nextCounter?.seq ?? maxExistingSequence + 1;

  return `EMP-${String(nextSequence).padStart(6, "0")}`;
}

async function generateNextOrgUnitCode(db: MongoDb) {
  const orgUnits = db.collection<Pick<AdminOrgDoc, "code">>("orgUnits");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateOrgUnitCode(new Date(Date.now() + attempt));
    const existing = await orgUnits.findOne(
      { code: candidate },
      { projection: { code: 1 } },
    );

    if (!existing) {
      return candidate;
    }
  }

  throw new AdminStoreError("조직코드를 생성하지 못했습니다. 다시 시도해 주세요.", 500);
}

function buildCatalogFromDocuments(input: {
  users: AdminUserDoc[];
  orgUnits: AdminOrgDoc[];
  roles: AdminRoleDoc[];
  policies: AdminPolicyDoc[];
  projects: AdminProjectDoc[];
}): AdminCatalog {
  const projectOptionMap = new Map<string, AdminProjectOptionRecord>();
  const projectReferenceMap = new Map<
    string,
    {
      code: string;
      name: string;
      status: string;
    }
  >();

  for (const [index, project] of input.projects.entries()) {
    const projectId = normalizeId(project._id, `project-${index + 1}`);
    const projectRecord = {
      code: project.code ?? `PRJ-${index + 1}`,
      name: project.name ?? "미정 프로젝트",
      status: project.status ?? "planning",
    };
    projectReferenceMap.set(projectId, projectRecord);

    if (projectRecord.status !== "archived") {
      projectOptionMap.set(projectId, {
        projectId,
        code: projectRecord.code,
        name: projectRecord.name,
        status: projectRecord.status,
      });
    }
  }
  const projectOptions = [...projectOptionMap.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const orgUnits = input.orgUnits.map((orgUnit, index) => {
    const matchedLead =
      (orgUnit.leadUserId
        ? input.users.find(
            (user) =>
              normalizeId(user._id, user.id ?? "") === orgUnit.leadUserId ||
              user.id === orgUnit.leadUserId,
          )
        : null) ??
      input.users.find((user) => user.email === orgUnit.leadEmail) ??
      input.users.find(
        (user) => user.name === orgUnit.leadName || user.displayName === orgUnit.leadName,
      );

    return {
      id: orgUnit.id ?? normalizeId(orgUnit._id, `org-${index + 1}`),
      code: orgUnit.code ?? `ORG-${index + 1}`,
      name: orgUnit.name ?? "미정 조직",
      category: orgUnit.category ?? "운영",
      leadName: orgUnit.leadName ?? matchedLead?.name ?? matchedLead?.displayName ?? "-",
      leadUserId:
        orgUnit.leadUserId ?? matchedLead?.id ?? normalizeId(matchedLead?._id, ""),
      leadEmail: orgUnit.leadEmail ?? matchedLead?.email ?? "",
      memberCount: toNumber(orgUnit.memberCount, 0),
      state: orgUnit.state ?? "활성",
    };
  }) satisfies AdminOrgRecord[];

  const roles = input.roles.map((role, index) => ({
    id: role.id ?? normalizeId(role._id, `role-${index + 1}`),
    code: role.code ?? `ROLE-${index + 1}`,
    name: role.name ?? "미정 역할",
    scope: role.scope ?? "공통",
    memberCount: toNumber(role.memberCount, 0),
    state: role.state ?? "활성",
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
  })) satisfies AdminRoleRecord[];

  const users = input.users.map((user, index) => {
    const matchedOrg = orgUnits.find((orgUnit) => orgUnit.code === user.orgUnitCode);
    const matchedRole = roles.find((role) => role.code === user.roleCode);
    const rawAssignments = Array.isArray(user.projectAssignments) ? user.projectAssignments : [];
    const projectAssignments = rawAssignments
      .map((assignment) => {
        const projectId = toTrimmedString(assignment?.projectId);

        if (!projectId) {
          return null;
        }

        const projectReference = projectReferenceMap.get(projectId);

        return {
          projectId,
          projectCode: projectReference?.code ?? projectId,
          projectName: projectReference?.name ?? "알 수 없는 프로젝트",
        } satisfies AdminUserProjectAssignmentRecord;
      })
      .filter((assignment): assignment is AdminUserProjectAssignmentRecord => assignment !== null);
    const defaultProjectId = toTrimmedString(user.defaultProjectId);

    return {
      id: user.id ?? normalizeId(user._id, `usr-${index + 1}`),
      name: user.name ?? user.displayName ?? "미정 사용자",
      email: user.email ?? "",
      employeeNo: user.employeeNo ?? `EMP-${String(index + 1).padStart(6, "0")}`,
      orgUnitCode: user.orgUnitCode ?? matchedOrg?.code ?? "",
      orgUnitName: user.orgUnitName ?? matchedOrg?.name ?? "미정 조직",
      roleCode: user.roleCode ?? matchedRole?.code ?? "",
      roleName: user.roleName ?? matchedRole?.name ?? "미정 역할",
      provider: user.provider ?? "Google SSO",
      state: user.state ?? "활성",
      lastSeenAt: user.lastSeenAt ?? "-",
      defaultProjectId:
        projectAssignments.some((assignment) => assignment.projectId === defaultProjectId)
          ? defaultProjectId
          : projectAssignments[0]?.projectId ?? "",
      projectAssignments,
    };
  }) satisfies AdminUserRecord[];

  const orgMemberCount = new Map<string, number>();
  const roleMemberCount = new Map<string, number>();

  for (const user of users) {
    orgMemberCount.set(user.orgUnitCode, (orgMemberCount.get(user.orgUnitCode) ?? 0) + 1);
    roleMemberCount.set(user.roleCode, (roleMemberCount.get(user.roleCode) ?? 0) + 1);
  }

  const normalizedOrgUnits = orgUnits.map((orgUnit) => ({
    ...orgUnit,
    memberCount: orgMemberCount.get(orgUnit.code) || 0,
  }));

  const normalizedRoles = roles.map((role) => ({
    ...role,
    memberCount: roleMemberCount.get(role.code) || 0,
  }));

  const policies = input.policies.map((policy, index) => ({
    id: policy.id ?? normalizeId(policy._id, `policy-${index + 1}`),
    code: policy.code ?? `POL-${index + 1}`,
    name: policy.name ?? "미정 정책",
    target: policy.target ?? "전체 사용자",
    state: policy.state ?? "활성",
    ruleSummary: policy.ruleSummary ?? "-",
  })) satisfies AdminPolicyRecord[];

  return {
    users,
    orgUnits: normalizedOrgUnits,
    roles: normalizedRoles,
    policies,
    projectOptions,
  };
}

function isCatalogPopulated(catalog: AdminCatalog) {
  return (
    catalog.users.length > 0 ||
    catalog.orgUnits.length > 0 ||
    catalog.roles.length > 0 ||
    catalog.policies.length > 0
  );
}

async function loadAdminCatalogFromDatabase() {
  const db = await getMongoDb();
  const [users, orgUnits, roles, policies, projects] = await Promise.all([
    db.collection<AdminUserDoc>("users").find({}).toArray(),
    db.collection<AdminOrgDoc>("orgUnits").find({}).toArray(),
    db.collection<AdminRoleDoc>("roles").find({}).toArray(),
    db.collection<AdminPolicyDoc>("policies").find({}).toArray(),
    db.collection<AdminProjectDoc>("projects").find({}).toArray(),
  ]);

  return buildCatalogFromDocuments({
    users,
    orgUnits,
    roles,
    policies,
    projects,
  });
}

async function resolveProvisionReferences(input: {
  orgUnitCode: string;
  roleCode: string;
}) {
  const db = await getMongoDb();
  const [orgUnit, role] = await Promise.all([
    db.collection<AdminOrgDoc>("orgUnits").findOne({ code: input.orgUnitCode }),
    db.collection<AdminRoleDoc>("roles").findOne({ code: input.roleCode }),
  ]);

  if (!orgUnit) {
    throw new AdminStoreError("선택한 조직을 찾을 수 없습니다.");
  }

  if (!role) {
    throw new AdminStoreError("선택한 역할을 찾을 수 없습니다.");
  }

  return {
    db,
    orgUnit: {
      code: orgUnit.code ?? input.orgUnitCode,
      name: orgUnit.name ?? "미정 조직",
    },
    role: {
      code: role.code ?? input.roleCode,
      name: role.name ?? "미정 역할",
    },
  };
}

async function resolveUserProjectAssignments(
  db: MongoDb,
  assignments: NormalizedUserProjectAssignment[],
  defaultProjectId: string,
) {
  const { ObjectId } = await import("mongodb");

  for (const assignment of assignments) {
    if (!ObjectId.isValid(assignment.projectId)) {
      throw new AdminStoreError("유효하지 않은 프로젝트 ID가 포함되어 있습니다.");
    }
  }

  const projectIds = assignments.map((assignment) => assignment.projectId);
  const projects =
    projectIds.length > 0
      ? await db
          .collection<AdminProjectDoc>("projects")
          .find({ _id: { $in: projectIds.map((projectId) => new ObjectId(projectId)) } })
          .toArray()
      : [];

  const projectMap = new Map(
    projects.map((project) => [
      normalizeId(project._id, ""),
      {
        projectId: normalizeId(project._id, ""),
        projectCode: project.code ?? "",
        projectName: project.name ?? "미정 프로젝트",
        status: project.status ?? "planning",
      },
    ]),
  );
  const projectAssignments = assignments.map((assignment) => {
    const project = projectMap.get(assignment.projectId);

    if (!project || project.status === "archived") {
      throw new AdminStoreError("선택한 프로젝트를 찾을 수 없거나 이미 종료되었습니다.");
    }

    return {
      projectId: assignment.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
    } satisfies AdminUserProjectAssignmentRecord;
  });

  if (
    defaultProjectId &&
    !projectAssignments.some((assignment) => assignment.projectId === defaultProjectId)
  ) {
    throw new AdminStoreError("기본 프로젝트는 배정된 프로젝트 중에서만 선택할 수 있습니다.");
  }

  return {
    projectAssignments,
    defaultProjectId: defaultProjectId || projectAssignments[0]?.projectId || "",
    persistedAssignments: assignments.map((assignment) => ({
      projectId: assignment.projectId,
      siteIds: [],
    })),
  };
}

function buildProvisionedUserRecord(input: {
  id: string;
  form: AdminUserProvisionInput;
  employeeNo: string;
  orgUnitName: string;
  roleName: string;
  lastSeenAt?: string;
  defaultProjectId: string;
  projectAssignments: AdminUserProjectAssignmentRecord[];
}) {
  return {
    id: input.id,
    name: toTrimmedString(input.form.name),
    email: normalizeEmail(input.form.email),
    employeeNo: input.employeeNo,
    orgUnitCode: input.form.orgUnitCode,
    orgUnitName: input.orgUnitName,
    roleCode: input.form.roleCode,
    roleName: input.roleName,
    provider: "Google SSO",
    state: normalizeUserState(input.form.state),
    lastSeenAt: input.lastSeenAt ?? "-",
    defaultProjectId: input.defaultProjectId,
    projectAssignments: input.projectAssignments,
  } satisfies AdminUserRecord;
}

function validateProvisionInput(input: AdminUserProvisionInput) {
  const name = toTrimmedString(input.name);
  const email = normalizeEmail(input.email);
  const orgUnitCode = toTrimmedString(input.orgUnitCode);
  const roleCode = toTrimmedString(input.roleCode);
  const defaultProjectId = toTrimmedString(input.defaultProjectId);
  const projectAssignments = normalizeProjectAssignments(input.projectAssignments);

  if (!name || !email || !orgUnitCode || !roleCode) {
    throw new AdminStoreError("이름, 이메일, 조직, 역할은 필수입니다.");
  }

  if (!email.includes("@")) {
    throw new AdminStoreError("회사 이메일 형식이 올바르지 않습니다.");
  }

  return {
    name,
    email,
    orgUnitCode,
    roleCode,
    state: normalizeUserState(input.state),
    defaultProjectId,
    projectAssignments,
  } satisfies AdminUserProvisionInput;
}

function validateOrgProvisionInput(
  input: AdminOrgProvisionInput,
  options?: { requireCode?: boolean },
) {
  const requireCode = options?.requireCode ?? true;
  const code = toTrimmedString(input.code).toUpperCase();
  const name = toTrimmedString(input.name);
  const leadUserId = toTrimmedString(input.leadUserId);

  if ((!code && requireCode) || !name || !leadUserId) {
    throw new AdminStoreError(
      requireCode ? "조직코드, 조직명, 책임자는 필수입니다." : "조직명과 책임자는 필수입니다.",
    );
  }

  return {
    code,
    name,
    category: normalizeOrgCategory(input.category),
    leadUserId,
    state: normalizeOrgState(input.state),
  } satisfies AdminOrgProvisionInput;
}

function validateRoleProvisionInput(input: AdminRoleProvisionInput) {
  const code = toTrimmedString(input.code).toUpperCase();
  const name = toTrimmedString(input.name);

  if (!code || !name) {
    throw new AdminStoreError("역할코드와 역할명은 필수입니다.");
  }

  const permissions = parsePermissions(input.permissions);

  if (permissions.length === 0) {
    throw new AdminStoreError("최소 하나 이상의 권한 코드를 선택해야 합니다.");
  }

  return {
    code,
    name,
    scope: normalizeRoleScope(input.scope),
    permissions,
    state: normalizeRoleState(input.state),
  } satisfies AdminRoleProvisionInput;
}

function validatePolicyProvisionInput(input: AdminPolicyProvisionInput) {
  const code = toTrimmedString(input.code).toUpperCase();
  const name = toTrimmedString(input.name);
  const target = toTrimmedString(input.target);
  const ruleSummary = toTrimmedString(input.ruleSummary);

  if (!code || !name || !target || !ruleSummary) {
    throw new AdminStoreError("정책코드, 정책명, 적용 대상, 규칙 요약은 필수입니다.");
  }

  return {
    code,
    name,
    target,
    ruleSummary,
    state: normalizePolicyState(input.state),
  } satisfies AdminPolicyProvisionInput;
}

function buildOrgRecord(input: {
  id: string;
  form: AdminOrgProvisionInput;
  leadName: string;
  leadEmail: string;
  memberCount: number;
}) {
  return {
    id: input.id,
    code: input.form.code,
    name: input.form.name,
    category: input.form.category,
    leadName: input.leadName,
    leadUserId: input.form.leadUserId,
    leadEmail: input.leadEmail,
    memberCount: input.memberCount,
    state: input.form.state,
  } satisfies AdminOrgRecord;
}

function buildRoleRecord(input: {
  id: string;
  form: AdminRoleProvisionInput;
  memberCount: number;
}) {
  return {
    id: input.id,
    code: input.form.code,
    name: input.form.name,
    scope: input.form.scope,
    memberCount: input.memberCount,
    state: input.form.state,
    permissions: input.form.permissions,
  } satisfies AdminRoleRecord;
}

function buildPolicyRecord(input: {
  id: string;
  form: AdminPolicyProvisionInput;
}) {
  return {
    id: input.id,
    code: input.form.code,
    name: input.form.name,
    target: input.form.target,
    state: input.form.state,
    ruleSummary: input.form.ruleSummary,
  } satisfies AdminPolicyRecord;
}

export function isAdminStoreError(error: unknown): error is AdminStoreError {
  return error instanceof AdminStoreError;
}

export async function createAdminUser(
  input: AdminUserProvisionInput,
  context: AdminMutationContext,
): Promise<AdminUserMutationResult> {
  const normalizedInput = validateProvisionInput(input);
  const { db, orgUnit, role } = await resolveProvisionReferences({
    orgUnitCode: normalizedInput.orgUnitCode,
    roleCode: normalizedInput.roleCode,
  });
  const users = db.collection<AdminUserDoc>("users");

  const existingUser = await users.findOne({ email: normalizedInput.email });
  if (existingUser) {
    throw new AdminStoreError("이미 등록된 사용자 이메일입니다.", 409);
  }

  const now = new Date().toISOString();
  const employeeNo = await generateNextEmployeeNo(db);
  const projectScope = await resolveUserProjectAssignments(
    db,
    normalizedInput.projectAssignments ?? [],
    normalizedInput.defaultProjectId ?? "",
  );
  const payload = {
    name: normalizedInput.name,
    displayName: normalizedInput.name,
    email: normalizedInput.email,
    employeeNo,
    orgUnitCode: normalizedInput.orgUnitCode,
    orgUnitName: orgUnit.name,
    roleCode: normalizedInput.roleCode,
    roleName: role.name,
    provider: "Google SSO",
    state: normalizedInput.state,
    lastSeenAt: "-",
    defaultProjectId: projectScope.defaultProjectId,
    projectAssignments: projectScope.persistedAssignments,
    ...buildCreateMetadata(context.actor, now),
  };

  const result = await users.insertOne(payload);
  const record = buildProvisionedUserRecord({
    id: result.insertedId.toString(),
    form: normalizedInput,
    employeeNo,
    orgUnitName: orgUnit.name,
    roleName: role.name,
    defaultProjectId: projectScope.defaultProjectId,
    projectAssignments: projectScope.projectAssignments,
  });
  await recordAdminAuditLog({
    db,
    context,
    eventCode: "admin.user.created",
    resource: record.email,
  });

  return {
    action: "create",
    user: record,
  };
}

export async function updateAdminUser(
  userId: string,
  input: AdminUserProvisionInput,
  context: AdminMutationContext,
): Promise<AdminUserMutationResult> {
  const normalizedInput = validateProvisionInput(input);
  const { db, orgUnit, role } = await resolveProvisionReferences({
    orgUnitCode: normalizedInput.orgUnitCode,
    roleCode: normalizedInput.roleCode,
  });
  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(userId)) {
    throw new AdminStoreError("유효하지 않은 사용자 ID입니다.");
  }

  const users = db.collection<AdminUserDoc>("users");
  const currentUser = await users.findOne({ _id: new ObjectId(userId) });

  if (!currentUser) {
    throw new AdminStoreError("수정할 사용자를 찾을 수 없습니다.", 404);
  }

  const duplicatedEmail = await users.findOne({
    email: normalizedInput.email,
    _id: { $ne: new ObjectId(userId) },
  });

  if (duplicatedEmail) {
    throw new AdminStoreError("이미 다른 사용자에 배정된 이메일입니다.", 409);
  }

  const now = new Date().toISOString();
  const actorSnapshot = buildActorSnapshot(context.actor);
  const employeeNo =
    toTrimmedString(currentUser.employeeNo) || (await generateNextEmployeeNo(db));
  const projectScope = await resolveUserProjectAssignments(
    db,
    normalizedInput.projectAssignments ?? [],
    normalizedInput.defaultProjectId ?? "",
  );
  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        name: normalizedInput.name,
        displayName: normalizedInput.name,
        email: normalizedInput.email,
        employeeNo,
        orgUnitCode: normalizedInput.orgUnitCode,
        orgUnitName: orgUnit.name,
        roleCode: normalizedInput.roleCode,
        roleName: role.name,
        provider: "Google SSO",
        state: normalizedInput.state,
        defaultProjectId: projectScope.defaultProjectId,
        projectAssignments: projectScope.persistedAssignments,
        updatedAt: now,
        updatedBy: actorSnapshot,
      },
    },
  );
  await recordAdminAuditLog({
    db,
    context,
    eventCode:
      currentUser.state !== normalizedInput.state
        ? "admin.user.state.updated"
        : "admin.user.updated",
    resource: normalizedInput.email,
  });

  return {
    action: "update",
    user: buildProvisionedUserRecord({
      id: userId,
      form: normalizedInput,
      employeeNo,
      orgUnitName: orgUnit.name,
      roleName: role.name,
      lastSeenAt: currentUser.lastSeenAt ?? "-",
      defaultProjectId: projectScope.defaultProjectId,
      projectAssignments: projectScope.projectAssignments,
    }),
  };
}

export async function createAdminOrgUnit(
  input: AdminOrgProvisionInput,
  context: AdminMutationContext,
): Promise<AdminOrgMutationResult> {
  const normalizedInput = validateOrgProvisionInput(input, { requireCode: false });
  const db = await getMongoDb();
  const orgUnits = db.collection<AdminOrgDoc>("orgUnits");
  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(normalizedInput.leadUserId)) {
    throw new AdminStoreError("유효하지 않은 책임자 ID입니다.");
  }

  const leadUser = await db
    .collection<AdminUserDoc>("users")
    .findOne({ _id: new ObjectId(normalizedInput.leadUserId) });

  if (!leadUser) {
    throw new AdminStoreError("책임자로 지정할 사용자를 찾을 수 없습니다.");
  }

  const generatedCode = await generateNextOrgUnitCode(db);
  const createdInput = {
    ...normalizedInput,
    code: generatedCode,
  } satisfies AdminOrgProvisionInput;
  const payload = {
    code: createdInput.code,
    name: createdInput.name,
    category: createdInput.category,
    leadName: leadUser.name ?? leadUser.displayName ?? "-",
    leadUserId: createdInput.leadUserId,
    leadEmail: leadUser.email ?? "",
    memberCount: 0,
    state: createdInput.state,
  };
  const result = await orgUnits.insertOne(payload);
  await recordAdminAuditLog({
    db,
    context,
    eventCode: "admin.org.created",
    resource: createdInput.code,
  });

  return {
    action: "create",
    orgUnit: buildOrgRecord({
      id: result.insertedId.toString(),
      form: createdInput,
      leadName: payload.leadName,
      leadEmail: payload.leadEmail,
      memberCount: 0,
    }),
  };
}

export async function updateAdminOrgUnit(
  orgUnitId: string,
  input: AdminOrgProvisionInput,
  context: AdminMutationContext,
): Promise<AdminOrgMutationResult> {
  const normalizedInput = validateOrgProvisionInput(input);
  const db = await getMongoDb();
  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(orgUnitId)) {
    throw new AdminStoreError("유효하지 않은 조직 ID입니다.");
  }

  if (!ObjectId.isValid(normalizedInput.leadUserId)) {
    throw new AdminStoreError("유효하지 않은 책임자 ID입니다.");
  }

  const orgUnits = db.collection<AdminOrgDoc>("orgUnits");
  const currentOrgUnit = await orgUnits.findOne({ _id: new ObjectId(orgUnitId) });

  if (!currentOrgUnit) {
    throw new AdminStoreError("수정할 조직을 찾을 수 없습니다.", 404);
  }

  const currentCode = toTrimmedString(currentOrgUnit.code).toUpperCase();
  if (currentCode && normalizedInput.code !== currentCode) {
    throw new AdminStoreError("조직코드는 변경할 수 없습니다.");
  }

  const duplicatedOrgUnit = await orgUnits.findOne({
    code: normalizedInput.code,
    _id: { $ne: new ObjectId(orgUnitId) },
  });

  if (duplicatedOrgUnit) {
    throw new AdminStoreError("이미 다른 조직에 배정된 코드입니다.", 409);
  }

  const leadUser = await db
    .collection<AdminUserDoc>("users")
    .findOne({ _id: new ObjectId(normalizedInput.leadUserId) });

  if (!leadUser) {
    throw new AdminStoreError("책임자로 지정할 사용자를 찾을 수 없습니다.");
  }

  const memberCount = await db
    .collection<AdminUserDoc>("users")
    .countDocuments({ orgUnitCode: currentOrgUnit.code ?? normalizedInput.code });

  await orgUnits.updateOne(
    { _id: new ObjectId(orgUnitId) },
    {
      $set: {
        code: normalizedInput.code,
        name: normalizedInput.name,
        category: normalizedInput.category,
        leadName: leadUser.name ?? leadUser.displayName ?? "-",
        leadUserId: normalizedInput.leadUserId,
        leadEmail: leadUser.email ?? "",
        memberCount,
        state: normalizedInput.state,
      },
    },
  );

  if ((currentOrgUnit.code ?? normalizedInput.code) !== normalizedInput.code) {
    await db.collection<AdminUserDoc>("users").updateMany(
      { orgUnitCode: currentOrgUnit.code },
      {
        $set: {
          orgUnitCode: normalizedInput.code,
          orgUnitName: normalizedInput.name,
        },
      },
    );
  } else {
    await db.collection<AdminUserDoc>("users").updateMany(
      { orgUnitCode: normalizedInput.code },
      {
        $set: {
          orgUnitName: normalizedInput.name,
        },
      },
    );
  }
  await recordAdminAuditLog({
    db,
    context,
    eventCode:
      currentOrgUnit.state !== normalizedInput.state
        ? "admin.org.state.updated"
        : "admin.org.updated",
    resource: normalizedInput.code,
  });

  return {
    action: "update",
    orgUnit: buildOrgRecord({
      id: orgUnitId,
      form: normalizedInput,
      leadName: leadUser.name ?? leadUser.displayName ?? "-",
      leadEmail: leadUser.email ?? "",
      memberCount,
    }),
  };
}

export async function createAdminRole(
  input: AdminRoleProvisionInput,
  context: AdminMutationContext,
): Promise<AdminRoleMutationResult> {
  const normalizedInput = validateRoleProvisionInput(input);
  const db = await getMongoDb();
  const roles = db.collection<AdminRoleDoc>("roles");
  const existingRole = await roles.findOne({ code: normalizedInput.code });

  if (existingRole) {
    throw new AdminStoreError("이미 등록된 역할코드입니다.", 409);
  }

  const payload = {
    code: normalizedInput.code,
    name: normalizedInput.name,
    scope: normalizedInput.scope,
    memberCount: 0,
    state: normalizedInput.state,
    permissions: normalizedInput.permissions,
  };
  const result = await roles.insertOne(payload);
  await recordAdminAuditLog({
    db,
    context,
    eventCode: "admin.role.created",
    resource: normalizedInput.code,
  });

  return {
    action: "create",
    role: buildRoleRecord({
      id: result.insertedId.toString(),
      form: normalizedInput,
      memberCount: 0,
    }),
  };
}

export async function updateAdminRole(
  roleId: string,
  input: AdminRoleProvisionInput,
  context: AdminMutationContext,
): Promise<AdminRoleMutationResult> {
  const normalizedInput = validateRoleProvisionInput(input);
  const db = await getMongoDb();
  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(roleId)) {
    throw new AdminStoreError("유효하지 않은 역할 ID입니다.");
  }

  const roles = db.collection<AdminRoleDoc>("roles");
  const currentRole = await roles.findOne({ _id: new ObjectId(roleId) });

  if (!currentRole) {
    throw new AdminStoreError("수정할 역할을 찾을 수 없습니다.", 404);
  }

  const duplicatedRole = await roles.findOne({
    code: normalizedInput.code,
    _id: { $ne: new ObjectId(roleId) },
  });

  if (duplicatedRole) {
    throw new AdminStoreError("이미 다른 역할에 배정된 코드입니다.", 409);
  }

  const memberCount = await db
    .collection<AdminUserDoc>("users")
    .countDocuments({ roleCode: currentRole.code ?? normalizedInput.code });

  await roles.updateOne(
    { _id: new ObjectId(roleId) },
    {
      $set: {
        code: normalizedInput.code,
        name: normalizedInput.name,
        scope: normalizedInput.scope,
        permissions: normalizedInput.permissions,
        memberCount,
        state: normalizedInput.state,
      },
    },
  );

  if ((currentRole.code ?? normalizedInput.code) !== normalizedInput.code) {
    await db.collection<AdminUserDoc>("users").updateMany(
      { roleCode: currentRole.code },
      {
        $set: {
          roleCode: normalizedInput.code,
          roleName: normalizedInput.name,
        },
      },
    );
  } else {
    await db.collection<AdminUserDoc>("users").updateMany(
      { roleCode: normalizedInput.code },
      {
        $set: {
          roleName: normalizedInput.name,
        },
      },
    );
  }
  await recordAdminAuditLog({
    db,
    context,
    eventCode:
      currentRole.state !== normalizedInput.state
        ? "admin.role.state.updated"
        : "admin.role.updated",
    resource: normalizedInput.code,
  });

  return {
    action: "update",
    role: buildRoleRecord({
      id: roleId,
      form: normalizedInput,
      memberCount,
    }),
  };
}

export async function createAdminPolicy(
  input: AdminPolicyProvisionInput,
  context: AdminMutationContext,
): Promise<AdminPolicyMutationResult> {
  const normalizedInput = validatePolicyProvisionInput(input);
  const db = await getMongoDb();
  const policies = db.collection<AdminPolicyDoc>("policies");
  const existingPolicy = await policies.findOne({ code: normalizedInput.code });

  if (existingPolicy) {
    throw new AdminStoreError("이미 등록된 정책코드입니다.", 409);
  }

  const payload = {
    code: normalizedInput.code,
    name: normalizedInput.name,
    target: normalizedInput.target,
    state: normalizedInput.state,
    ruleSummary: normalizedInput.ruleSummary,
  };
  const result = await policies.insertOne(payload);
  await recordAdminAuditLog({
    db,
    context,
    eventCode: "admin.policy.created",
    resource: normalizedInput.code,
  });

  return {
    action: "create",
    policy: buildPolicyRecord({
      id: result.insertedId.toString(),
      form: normalizedInput,
    }),
  };
}

export async function updateAdminPolicy(
  policyId: string,
  input: AdminPolicyProvisionInput,
  context: AdminMutationContext,
): Promise<AdminPolicyMutationResult> {
  const normalizedInput = validatePolicyProvisionInput(input);
  const db = await getMongoDb();
  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(policyId)) {
    throw new AdminStoreError("유효하지 않은 정책 ID입니다.");
  }

  const policies = db.collection<AdminPolicyDoc>("policies");
  const currentPolicy = await policies.findOne({ _id: new ObjectId(policyId) });

  if (!currentPolicy) {
    throw new AdminStoreError("수정할 정책을 찾을 수 없습니다.", 404);
  }

  const duplicatedPolicy = await policies.findOne({
    code: normalizedInput.code,
    _id: { $ne: new ObjectId(policyId) },
  });

  if (duplicatedPolicy) {
    throw new AdminStoreError("이미 다른 정책에 배정된 코드입니다.", 409);
  }

  await policies.updateOne(
    { _id: new ObjectId(policyId) },
    {
      $set: {
        code: normalizedInput.code,
        name: normalizedInput.name,
        target: normalizedInput.target,
        ruleSummary: normalizedInput.ruleSummary,
        state: normalizedInput.state,
      },
    },
  );
  await recordAdminAuditLog({
    db,
    context,
    eventCode:
      currentPolicy.state !== normalizedInput.state
        ? "admin.policy.state.updated"
        : "admin.policy.updated",
    resource: normalizedInput.code,
  });

  return {
    action: "update",
    policy: buildPolicyRecord({
      id: policyId,
      form: normalizedInput,
    }),
  };
}

export async function getAdminCatalogFromStore(): Promise<AdminCatalogResult> {
  if (!isMongoConfigured()) {
    return {
      catalog: emptyAdminCatalog,
      source: "empty",
      error: "데이터베이스가 연결되지 않았습니다.",
    };
  }

  try {
    const catalog = await loadAdminCatalogFromDatabase();

    if (!isCatalogPopulated(catalog)) {
      return {
        catalog: emptyAdminCatalog,
        source: "empty",
      };
    }

    return {
      catalog,
      source: "database",
    };
  } catch (error) {
    return {
      catalog: emptyAdminCatalog,
      source: "empty",
      error: error instanceof Error ? error.message : "Unknown MongoDB error",
    };
  }
}

export async function findAdminAuthContextByEmail(
  email: string,
): Promise<AdminAuthContext> {
  const result = await getAdminCatalogFromStore();
  const normalizedEmail = email.toLowerCase();
  const user =
    result.catalog.users.find((entry) => entry.email.toLowerCase() === normalizedEmail) ??
    null;
  const role =
    user
      ? result.catalog.roles.find((entry) => entry.code === user.roleCode) ?? null
      : null;
  const orgUnit =
    user
      ? result.catalog.orgUnits.find((entry) => entry.code === user.orgUnitCode) ?? null
      : null;
  const policyCodes = result.catalog.policies
    .filter((policy) => policy.state !== "비활성")
    .filter((policy) =>
      role
        ? policy.target === "전체 사용자" ||
          policy.target === orgUnit?.category ||
          policy.target === role.scope ||
          policy.target === role.name ||
          policy.target === "문서/협업" ||
          policy.target === "재무 역할"
        : policy.target === "전체 사용자",
    )
    .map((policy) => policy.code);

  return {
    user,
    role,
    orgUnit,
    policyCodes,
    source: result.source,
  };
}
