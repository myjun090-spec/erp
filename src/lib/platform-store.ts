import {
  type AppRole,
  type NotificationItem,
  type SavedViewItem,
} from "@/lib/navigation";
import { ObjectId, type Filter } from "mongodb";
import { getMongoDb, isMongoConfigured } from "@/lib/mongodb";
import {
  type WorkspaceOwnerOption,
  type ApprovalHistoryRecord,
  type ApprovalTaskRecord,
  type AuditLogRecord,
  type WorkspacePostAccessRecord,
  type WorkspacePostRecord,
  type WorkspacePostVersionRecord,
} from "@/lib/platform-catalog";
import { getAdminCatalogFromStore } from "@/lib/admin-store";
import { buildWorkspacePostDetailHref } from "@/lib/workspace-navigation";
import {
  canArchiveWorkspacePost,
  canCancelWorkspacePostReview,
  canPublishWorkspacePost,
  canRejectWorkspacePostReview,
  canRequestWorkspacePostReview,
  canRestoreWorkspacePost,
  type WorkspacePostAction,
} from "@/lib/workspace-post-status";

type RoleScoped = {
  roles?: AppRole[];
};

type EmailScoped = {
  ownerEmail?: string | null;
};

type ApprovalHistoryDoc = Partial<ApprovalHistoryRecord> & RoleScoped & { _id?: { toString(): string } | string };
type AuditLogDoc = Partial<AuditLogRecord> & RoleScoped & { _id?: { toString(): string } | string };
type WorkspacePostDoc = Partial<WorkspacePostRecord> &
  RoleScoped & {
    _id?: { toString(): string } | string;
    versionHistory?: WorkspacePostVersionRecord[];
    accessHistory?: WorkspacePostAccessRecord[];
  };
type ApprovalTaskDoc = Partial<ApprovalTaskRecord> & RoleScoped & { _id?: { toString(): string } | string };
type SavedViewDoc = Partial<SavedViewItem> & RoleScoped & EmailScoped & { _id?: { toString(): string } | string };
type NotificationDoc = Partial<NotificationItem> & RoleScoped & EmailScoped & { _id?: { toString(): string } | string };

export type PlatformWorkspaceOverview = {
  notices: WorkspacePostRecord[];
  libraries: WorkspacePostRecord[];
  approvalTasks: ApprovalTaskRecord[];
  approvalHistory: ApprovalHistoryRecord[];
  source: "database" | "empty";
};

export type WorkspacePostDetailFromStore = {
  post: WorkspacePostRecord;
  relatedPosts: WorkspacePostRecord[];
  versionHistory: WorkspacePostVersionRecord[];
  accessHistory: WorkspacePostAccessRecord[];
  source: "database" | "empty";
};

export async function getWorkspaceOwnerOptionsFromStore(): Promise<{
  ownerOptions: WorkspaceOwnerOption[];
  source: "database" | "empty";
}> {
  const result = await getAdminCatalogFromStore();
  const ownerOptions = result.catalog.orgUnits
    .filter((orgUnit) => orgUnit.state !== "비활성")
    .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    .map((orgUnit) => ({ label: `${orgUnit.code} · ${orgUnit.name}`, value: orgUnit.name }));

  return {
    ownerOptions,
    source: result.source,
  };
}

export async function isWorkspaceOwnerInStore(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  const { ownerOptions } = await getWorkspaceOwnerOptionsFromStore();
  return ownerOptions.some((option) => option.value === normalized);
}

function normalizeId(value: { toString(): string } | string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return typeof value === "string" ? value : value.toString();
}

function buildWorkspacePostSelector(id: string): Filter<WorkspacePostDoc> {
  return ObjectId.isValid(id)
    ? ({ $or: [{ _id: new ObjectId(id) }, { id }] } as Filter<WorkspacePostDoc>)
    : { id };
}

function includesRole(record: RoleScoped, role: AppRole) {
  return !record.roles || record.roles.length === 0 || record.roles.includes(role);
}

function includesViewer(record: RoleScoped & EmailScoped, role: AppRole, email: string) {
  if (record.ownerEmail && record.ownerEmail.toLowerCase() === email.toLowerCase()) {
    return true;
  }

  return includesRole(record, role);
}

function normalizeApprovalHistory(record: ApprovalHistoryDoc, index: number): ApprovalHistoryRecord {
  return {
    id: record.id ?? normalizeId(record._id, `approval-history-${index + 1}`),
    action: record.action ?? "미정 승인 이력",
    target: record.target ?? "-",
    actor: record.actor ?? "-",
    team: record.team ?? "-",
    occurredAt: record.occurredAt ?? "-",
    result: record.result ?? "대기",
    href: record.href ?? "/workspace",
    roles: record.roles && record.roles.length > 0 ? record.roles : ["platform_admin", "domain_lead"],
    resourceType: typeof record.resourceType === "string" ? record.resourceType : null,
    resourceId: typeof record.resourceId === "string" ? record.resourceId : null,
    resourceKind:
      record.resourceKind === "notice" || record.resourceKind === "library"
        ? record.resourceKind
        : null,
    documentRef: typeof record.documentRef === "string" ? record.documentRef : null,
    versionLabel: typeof record.versionLabel === "string" ? record.versionLabel : null,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}

function normalizeAuditLog(record: AuditLogDoc, index: number): AuditLogRecord {
  return {
    id: record.id ?? normalizeId(record._id, `audit-${index + 1}`),
    eventCode: record.eventCode ?? "event.unknown",
    actor: record.actor ?? "-",
    resource: record.resource ?? "-",
    route: record.route ?? "/",
    ipAddress: record.ipAddress ?? "-",
    occurredAt: record.occurredAt ?? "-",
    result: record.result ?? "success",
    roles: record.roles && record.roles.length > 0 ? record.roles : ["platform_admin"],
  };
}

function normalizeWorkspacePost(record: WorkspacePostDoc, index: number): WorkspacePostRecord {
  const normalizedVersionHistory = normalizeWorkspacePostVersionHistory(record.versionHistory);
  const normalizedAccessHistory = normalizeWorkspacePostAccessHistory(record.accessHistory);

  return {
    id: record.id ?? normalizeId(record._id, `post-${index + 1}`),
    title: record.title ?? "미정 게시물",
    owner: record.owner ?? "ERP Platform",
    updatedAt: record.updatedAt ?? "-",
    status: record.status ?? "초안",
    kind: record.kind === "library" ? "library" : "notice",
    href: record.href ?? "/workspace",
    roles: record.roles && record.roles.length > 0 ? record.roles : ["platform_admin", "domain_lead", "executive"],
    linkedMenuHref:
      typeof record.linkedMenuHref === "string" ? record.linkedMenuHref : null,
    linkedMenuLabel:
      typeof record.linkedMenuLabel === "string" ? record.linkedMenuLabel : null,
    linkedPermission:
      typeof record.linkedPermission === "string" ? record.linkedPermission : null,
    documentRef:
      typeof record.documentRef === "string" ? record.documentRef : null,
    archivedFromStatus:
      typeof record.archivedFromStatus === "string" ? record.archivedFromStatus : null,
    versionLabel:
      typeof record.versionLabel === "string"
        ? record.versionLabel
        : normalizedVersionHistory[0]?.versionLabel ?? "v1.0",
    publishedAt:
      typeof record.publishedAt === "string" ? record.publishedAt : null,
    viewCount: normalizedAccessHistory.filter((entry) => entry.action === "view").length,
    refCopyCount: normalizedAccessHistory.filter((entry) => entry.action === "ref-copy").length,
  };
}

function normalizeApprovalTask(record: ApprovalTaskDoc, index: number): ApprovalTaskRecord {
  return {
    id: record.id ?? normalizeId(record._id, `task-${index + 1}`),
    title: record.title ?? "미정 승인 작업",
    owner: record.owner ?? "-",
    updatedAt: record.updatedAt ?? "-",
    status: record.status ?? "대기",
    href: record.href ?? "/workspace",
    roles: record.roles && record.roles.length > 0 ? record.roles : ["platform_admin", "domain_lead"],
    resourceType: typeof record.resourceType === "string" ? record.resourceType : null,
    resourceId: typeof record.resourceId === "string" ? record.resourceId : null,
    resourceKind:
      record.resourceKind === "notice" || record.resourceKind === "library"
        ? record.resourceKind
        : null,
    documentRef: typeof record.documentRef === "string" ? record.documentRef : null,
    versionLabel: typeof record.versionLabel === "string" ? record.versionLabel : null,
  };
}

function normalizeWorkspacePostVersionHistory(
  history: WorkspacePostDoc["versionHistory"],
): WorkspacePostVersionRecord[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .map((entry, index) => {
      const changeType: WorkspacePostVersionRecord["changeType"] =
        entry.changeType === "edit" || entry.changeType === "publish" || entry.changeType === "restore"
          ? entry.changeType
          : "create";

      return {
        id: typeof entry.id === "string" ? entry.id : `version-${index + 1}`,
        versionLabel: typeof entry.versionLabel === "string" ? entry.versionLabel : `v1.${index}`,
        changedAt: typeof entry.changedAt === "string" ? entry.changedAt : "-",
        changedBy: typeof entry.changedBy === "string" ? entry.changedBy : "-",
        team: typeof entry.team === "string" ? entry.team : "-",
        changeType,
        note: typeof entry.note === "string" ? entry.note : null,
      };
    })
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt, "ko"));
}

function normalizeWorkspacePostAccessHistory(
  history: WorkspacePostDoc["accessHistory"],
): WorkspacePostAccessRecord[] {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .map((entry, index) => {
      const action: WorkspacePostAccessRecord["action"] =
        entry.action === "ref-copy" ? "ref-copy" : "view";

      return {
        id: typeof entry.id === "string" ? entry.id : `access-${index + 1}`,
        action,
        actor: typeof entry.actor === "string" ? entry.actor : "-",
        team: typeof entry.team === "string" ? entry.team : "-",
        occurredAt: typeof entry.occurredAt === "string" ? entry.occurredAt : "-",
      };
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, "ko"));
}

function createWorkspacePostVersionHistoryEntry(input: {
  versionLabel: string;
  changedBy: string;
  team: string;
  changeType: WorkspacePostVersionRecord["changeType"];
  note?: string | null;
}) {
  return {
    id: new ObjectId().toString(),
    versionLabel: input.versionLabel,
    changedAt: new Date().toISOString(),
    changedBy: input.changedBy,
    team: input.team,
    changeType: input.changeType,
    note: input.note ?? null,
  } satisfies WorkspacePostVersionRecord;
}

function createWorkspacePostAccessHistoryEntry(input: {
  action: WorkspacePostAccessRecord["action"];
  actor: string;
  team: string;
}) {
  return {
    id: new ObjectId().toString(),
    action: input.action,
    actor: input.actor,
    team: input.team,
    occurredAt: new Date().toISOString(),
  } satisfies WorkspacePostAccessRecord;
}

function getNextWorkspacePostVersionLabel(currentValue: string | null | undefined) {
  const match = (currentValue ?? "v1.0").match(/^v(\d+)\.(\d+)$/i);
  if (!match) {
    return "v1.1";
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}

async function getWorkspacePostOrThrow(id: string) {
  const db = await getMongoDb();
  const raw = await db.collection<WorkspacePostDoc>("workspacePosts").findOne(
    buildWorkspacePostSelector(id),
  );

  if (!raw) {
    throw new Error("해당 게시물을 찾을 수 없습니다.");
  }

  return {
    db,
    post: normalizeWorkspacePost(raw, 0),
    versionHistory: normalizeWorkspacePostVersionHistory(raw.versionHistory),
    accessHistory: normalizeWorkspacePostAccessHistory(raw.accessHistory),
  };
}

function getWorkspaceWorkflowLabel(kind: WorkspacePostRecord["kind"]) {
  return kind === "library" ? "자료실" : "공지";
}

function getWorkspaceApprovalRoles(post: WorkspacePostRecord): AppRole[] {
  return post.roles.filter((role) => role === "platform_admin" || role === "domain_lead");
}

async function appendWorkspaceApprovalHistory(input: {
  db: Awaited<ReturnType<typeof getMongoDb>>;
  post: WorkspacePostRecord;
  actorName: string;
  actorTeam: string;
  action: string;
  result: string;
  reason?: string | null;
}) {
  const occurredAt = new Date().toISOString();
  await input.db.collection("approvalHistory").insertOne({
    action: input.action,
    target: input.post.title,
    actor: input.actorName,
    team: input.actorTeam,
    occurredAt,
    result: input.result,
    href: buildWorkspacePostDetailHref(input.post.kind, input.post.id),
    roles: input.post.roles,
    resourceType: "workspace_post",
    resourceId: input.post.id,
    resourceKind: input.post.kind,
    documentRef: input.post.documentRef ?? null,
    versionLabel: input.post.versionLabel ?? null,
    reason: input.reason?.trim() ? input.reason.trim() : null,
  });
}

async function upsertWorkspaceApprovalTask(input: {
  db: Awaited<ReturnType<typeof getMongoDb>>;
  post: WorkspacePostRecord;
}) {
  await input.db.collection("approvalTasks").updateOne(
    {
      resourceType: "workspace_post",
      resourceId: input.post.id,
    },
    {
      $set: {
        title: `${getWorkspaceWorkflowLabel(input.post.kind)} 게시 승인 · ${input.post.title}`,
        owner: input.post.owner,
        updatedAt: new Date().toISOString(),
        status: "대기",
        href: buildWorkspacePostDetailHref(input.post.kind, input.post.id),
        roles: getWorkspaceApprovalRoles(input.post),
        resourceType: "workspace_post",
        resourceId: input.post.id,
        resourceKind: input.post.kind,
        documentRef: input.post.documentRef ?? null,
        versionLabel: input.post.versionLabel ?? null,
      },
    },
    { upsert: true },
  );
}

async function completeWorkspaceApprovalTask(input: {
  db: Awaited<ReturnType<typeof getMongoDb>>;
  postId: string;
}) {
  await input.db.collection("approvalTasks").updateMany(
    {
      resourceType: "workspace_post",
      resourceId: input.postId,
      status: { $in: ["대기", "진행중"] },
    },
    {
      $set: {
        status: "완료",
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

function normalizeSavedView(record: SavedViewDoc, index: number): SavedViewItem & RoleScoped & EmailScoped {
  return {
    id: record.id ?? normalizeId(record._id, `saved-view-${index + 1}`),
    title: record.title ?? "미정 저장 보기",
    href: record.href ?? "/dashboard",
    description: record.description ?? "-",
    roles: record.roles && record.roles.length > 0 ? record.roles : undefined,
    ownerEmail: record.ownerEmail ?? null,
  };
}

function normalizeNotification(record: NotificationDoc, index: number): NotificationItem & RoleScoped & EmailScoped {
  return {
    id: record.id ?? normalizeId(record._id, `notification-${index + 1}`),
    title: record.title ?? "미정 알림",
    body: record.body ?? "-",
    tone:
      record.tone === "success" || record.tone === "warning" || record.tone === "info"
        ? record.tone
        : "info",
    roles: record.roles && record.roles.length > 0 ? record.roles : undefined,
    ownerEmail: record.ownerEmail ?? null,
  };
}

async function loadPlatformCollections() {
  const db = await getMongoDb();

  const [
    approvalHistory,
    auditLogs,
    workspacePosts,
    approvalTasks,
    savedViews,
    notifications,
  ] = await Promise.all([
    db.collection<ApprovalHistoryDoc>("approvalHistory").find({}).toArray(),
    db.collection<AuditLogDoc>("auditLogs").find({}).toArray(),
    db.collection<WorkspacePostDoc>("workspacePosts").find({}).toArray(),
    db.collection<ApprovalTaskDoc>("approvalTasks").find({}).toArray(),
    db.collection<SavedViewDoc>("savedViews").find({}).toArray(),
    db.collection<NotificationDoc>("notifications").find({}).toArray(),
  ]);

  return {
    approvalHistory: approvalHistory.map(normalizeApprovalHistory),
    auditLogs: auditLogs.map(normalizeAuditLog),
    workspacePosts: workspacePosts.map(normalizeWorkspacePost),
    approvalTasks: approvalTasks.map(normalizeApprovalTask),
    savedViews: savedViews.map(normalizeSavedView),
    notifications: notifications.map(normalizeNotification),
  };
}

export async function getWorkspaceOverviewFromStore(role: AppRole): Promise<PlatformWorkspaceOverview> {
  if (!isMongoConfigured()) {
    return {
      notices: [],
      libraries: [],
      approvalTasks: [],
      approvalHistory: [],
      source: "empty",
    };
  }

  try {
    const data = await loadPlatformCollections();
    const notices = data.workspacePosts.filter((record) => includesRole(record, role) && record.kind === "notice");
    const libraries = data.workspacePosts.filter((record) => includesRole(record, role) && record.kind === "library");
    const approvalTasks = data.approvalTasks.filter((record) => includesRole(record, role));
    const approvalHistory = data.approvalHistory.filter((record) => includesRole(record, role));

    return {
      notices,
      libraries,
      approvalTasks,
      approvalHistory,
      source: "database",
    };
  } catch {
    return {
      notices: [],
      libraries: [],
      approvalTasks: [],
      approvalHistory: [],
      source: "empty",
    };
  }
}

export async function getWorkspacePostDetailFromStore(input: {
  postId: string;
  role: AppRole;
}): Promise<WorkspacePostDetailFromStore | null> {
  if (!isMongoConfigured()) {
    return null;
  }

  try {
    const data = await loadPlatformCollections();
    const raw = data.workspacePosts.find((record) => record.id === input.postId);
    if (!raw || !includesRole(raw, input.role)) {
      return null;
    }

    const db = await getMongoDb();
    const rawDoc = await db.collection<WorkspacePostDoc>("workspacePosts").findOne(
      buildWorkspacePostSelector(input.postId),
    );
    const relatedPosts = data.workspacePosts
      .filter(
        (record) =>
          includesRole(record, input.role) &&
          record.kind === raw.kind &&
          record.id !== raw.id,
      )
      .slice(0, 3);

    return {
      post: normalizeWorkspacePost(rawDoc ?? raw, 0),
      relatedPosts,
      versionHistory: normalizeWorkspacePostVersionHistory(rawDoc?.versionHistory),
      accessHistory: normalizeWorkspacePostAccessHistory(rawDoc?.accessHistory),
      source: "database",
    };
  } catch {
    return null;
  }
}

export async function getPersonalizationFromStore(input: {
  role: AppRole;
  email: string;
}) {
  if (!isMongoConfigured()) {
    return {
      savedViews: [],
      notifications: [],
      source: "empty" as const,
    };
  }

  try {
    const data = await loadPlatformCollections();
    const savedViews = data.savedViews
      .filter((record) => includesViewer(record, input.role, input.email))
      .map(({ id, title, href, description }) => ({ id, title, href, description }));
    const notifications = data.notifications
      .filter((record) => includesViewer(record, input.role, input.email))
      .map(({ id, title, body, tone }) => ({ id, title, body, tone }));

    return {
      savedViews,
      notifications,
      source: "database" as const,
    };
  } catch {
    return {
      savedViews: [],
      notifications: [],
      source: "empty" as const,
    };
  }
}

export async function getAuditLogsFromStore(role: AppRole) {
  if (!isMongoConfigured()) {
    return {
      auditLogs: [],
      source: "empty" as const,
    };
  }

  try {
    const data = await loadPlatformCollections();
    const auditLogs = data.auditLogs.filter((record) => includesRole(record, role));

    return {
      auditLogs,
      source: "database" as const,
    };
  } catch {
    return {
      auditLogs: [],
      source: "empty" as const,
    };
  }
}

export async function createWorkspacePostInStore(data: {
  title: string;
  kind: "notice" | "library";
  owner: string;
  linkedMenuHref: string;
  linkedMenuLabel: string;
  linkedPermission: WorkspacePostRecord["linkedPermission"];
  documentRef: string;
  actorName: string;
  actorTeam: string;
}): Promise<WorkspacePostRecord> {
  const db = await getMongoDb();
  const now = new Date().toISOString();
  const owner = data.owner.trim();

  if (!owner) {
    throw new Error("담당 조직을 선택해 주세요.");
  }

  if (!(await isWorkspaceOwnerInStore(owner))) {
    throw new Error("허용된 담당 조직만 선택할 수 있습니다.");
  }

  const doc = {
    title: data.title.trim(),
    kind: data.kind,
    owner,
    status: "초안",
    linkedMenuHref: data.linkedMenuHref,
    linkedMenuLabel: data.linkedMenuLabel,
    linkedPermission: data.linkedPermission ?? null,
    documentRef: data.documentRef.trim() || null,
    archivedFromStatus: null,
    versionLabel: "v1.0",
    publishedAt: null,
    versionHistory: [
      createWorkspacePostVersionHistoryEntry({
        versionLabel: "v1.0",
        changedBy: data.actorName,
        team: data.actorTeam,
        changeType: "create",
        note: "초기 등록",
      }),
    ],
    accessHistory: [],
    roles: ["platform_admin", "domain_lead", "executive"] as AppRole[],
    href: "/workspace",
    updatedAt: now,
    createdAt: now,
  };
  const result = await db.collection<WorkspacePostDoc>("workspacePosts").insertOne(doc);
  return { ...doc, id: result.insertedId.toString() };
}

export async function updateWorkspacePostInStore(id: string, data: {
  title?: string;
  owner?: string;
  linkedMenuHref?: string;
  linkedMenuLabel?: string;
  linkedPermission?: WorkspacePostRecord["linkedPermission"];
  documentRef?: string;
  actorName: string;
  actorTeam: string;
}) {
  const { db, post, versionHistory } = await getWorkspacePostOrThrow(id);
  const fields: Record<string, unknown> = {};
  if (data.title !== undefined) fields.title = data.title.trim();
  if (data.owner !== undefined) {
    const owner = data.owner.trim();
    if (!owner) {
      throw new Error("담당 조직을 선택해 주세요.");
    }
    if (!(await isWorkspaceOwnerInStore(owner))) {
      throw new Error("허용된 담당 조직만 선택할 수 있습니다.");
    }
    fields.owner = owner;
  }
  if (data.linkedMenuHref !== undefined) fields.linkedMenuHref = data.linkedMenuHref;
  if (data.linkedMenuLabel !== undefined) fields.linkedMenuLabel = data.linkedMenuLabel;
  if (data.linkedPermission !== undefined) fields.linkedPermission = data.linkedPermission;
  if (data.documentRef !== undefined) fields.documentRef = data.documentRef.trim() || null;
  fields.updatedAt = new Date().toISOString();
  const nextVersionLabel = getNextWorkspacePostVersionLabel(post.versionLabel);
  fields.versionLabel = nextVersionLabel;
  fields.versionHistory = [
    createWorkspacePostVersionHistoryEntry({
      versionLabel: nextVersionLabel,
      changedBy: data.actorName,
      team: data.actorTeam,
      changeType: "edit",
      note: "메타데이터 수정",
    }),
    ...versionHistory,
  ].slice(0, 30);
  await db.collection<WorkspacePostDoc>("workspacePosts").updateOne(
    buildWorkspacePostSelector(id),
    { $set: fields },
  );
}

export async function transitionWorkspacePostInStore(input: {
  id: string;
  action: WorkspacePostAction;
  actorName: string;
  actorTeam: string;
  reason?: string;
}) {
  const { db, post, versionHistory } = await getWorkspacePostOrThrow(input.id);
  const now = new Date().toISOString();
  let nextStatus = post.status;
  let historyAction = "";
  let historyResult = "완료";
  const setFields: Record<string, unknown> = {
    updatedAt: now,
  };

  switch (input.action) {
    case "request-review":
      if (!canRequestWorkspacePostReview(post.status)) {
        throw new Error("초안 상태의 게시물만 검토 요청할 수 있습니다.");
      }
      nextStatus = "검토중";
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 검토 요청`;
      historyResult = "대기";
      break;
    case "cancel-review":
      if (!canCancelWorkspacePostReview(post.status)) {
        throw new Error("검토중 상태의 게시물만 검토 취소할 수 있습니다.");
      }
      nextStatus = "초안";
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 검토 취소`;
      break;
    case "reject-review":
      if (!canRejectWorkspacePostReview(post.status)) {
        throw new Error("검토중 상태의 게시물만 반려할 수 있습니다.");
      }
      if (!input.reason?.trim()) {
        throw new Error("반려 사유를 입력해 주세요.");
      }
      nextStatus = "초안";
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 검토 반려`;
      historyResult = "반려";
      break;
    case "publish":
      if (!canPublishWorkspacePost(post.status)) {
        throw new Error("검토중 상태의 게시물만 게시 승인할 수 있습니다.");
      }
      nextStatus = "게시중";
      setFields.publishedAt = now;
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 게시 승인`;
      historyResult = "승인";
      break;
    case "archive":
      if (!canArchiveWorkspacePost(post.status)) {
        throw new Error("현재 상태에서는 보관할 수 없습니다.");
      }
      nextStatus = "보관";
      setFields.archivedFromStatus =
        post.status === "보관" ? post.archivedFromStatus ?? "초안" : post.status;
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 보관`;
      break;
    case "restore":
      if (!canRestoreWorkspacePost(post.status)) {
        throw new Error("보관 상태의 게시물만 복원할 수 있습니다.");
      }
      nextStatus = post.archivedFromStatus ?? "초안";
      setFields.archivedFromStatus = null;
      historyAction = `${getWorkspaceWorkflowLabel(post.kind)} 복원`;
      break;
  }

  setFields.status = nextStatus;
  if (input.action === "publish") {
    const nextVersionLabel = getNextWorkspacePostVersionLabel(post.versionLabel);
    setFields.versionLabel = nextVersionLabel;
    setFields.versionHistory = [
      createWorkspacePostVersionHistoryEntry({
        versionLabel: nextVersionLabel,
        changedBy: input.actorName,
        team: input.actorTeam,
        changeType: "publish",
        note: "게시 승인",
      }),
      ...versionHistory,
    ].slice(0, 30);
  } else if (input.action === "restore") {
    setFields.versionHistory = [
      createWorkspacePostVersionHistoryEntry({
        versionLabel: post.versionLabel ?? "v1.0",
        changedBy: input.actorName,
        team: input.actorTeam,
        changeType: "restore",
        note: "보관 문서 복원",
      }),
      ...versionHistory,
    ].slice(0, 30);
  }
  await db.collection<WorkspacePostDoc>("workspacePosts").updateOne(
    buildWorkspacePostSelector(input.id),
    { $set: setFields },
  );

  const nextPost: WorkspacePostRecord = {
    ...post,
    status: nextStatus,
    updatedAt: now,
    archivedFromStatus:
      input.action === "archive"
        ? (setFields.archivedFromStatus as string | null)
        : input.action === "restore"
          ? null
          : post.archivedFromStatus ?? null,
    versionLabel:
      (typeof setFields.versionLabel === "string" ? setFields.versionLabel : post.versionLabel) ?? "v1.0",
    publishedAt:
      (typeof setFields.publishedAt === "string" ? setFields.publishedAt : post.publishedAt) ?? null,
  };

  if (input.action === "request-review" || (input.action === "restore" && nextPost.status === "검토중")) {
    await upsertWorkspaceApprovalTask({ db, post: nextPost });
  } else if (
    input.action === "cancel-review" ||
    input.action === "reject-review" ||
    input.action === "publish" ||
    input.action === "archive"
  ) {
    await completeWorkspaceApprovalTask({ db, postId: input.id });
  }

  await appendWorkspaceApprovalHistory({
    db,
    post: nextPost,
    actorName: input.actorName,
    actorTeam: input.actorTeam,
    action: historyAction,
    result: historyResult,
    reason: input.action === "reject-review" ? input.reason : null,
  });

  return nextPost;
}

export async function logWorkspacePostAccessInStore(input: {
  id: string;
  action: WorkspacePostAccessRecord["action"];
  actorName: string;
  actorTeam: string;
}) {
  const { db, accessHistory } = await getWorkspacePostOrThrow(input.id);
  const nextHistory = [
    createWorkspacePostAccessHistoryEntry({
      action: input.action,
      actor: input.actorName,
      team: input.actorTeam,
    }),
    ...accessHistory,
  ].slice(0, 50);

  await db.collection<WorkspacePostDoc>("workspacePosts").updateOne(
    buildWorkspacePostSelector(input.id),
    {
      $set: {
        accessHistory: nextHistory,
        updatedAt: new Date().toISOString(),
      },
    },
  );
}

export async function archiveWorkspacePostInStore(input: {
  id: string;
  actorName: string;
  actorTeam: string;
}) {
  return transitionWorkspacePostInStore({
    id: input.id,
    action: "archive",
    actorName: input.actorName,
    actorTeam: input.actorTeam,
  });
}
