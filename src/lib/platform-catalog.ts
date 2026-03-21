import type { AppRole } from "@/lib/navigation";
import type { KnownPermissionCode } from "@/lib/permission-catalog";

export type ApprovalHistoryRecord = {
  id: string;
  action: string;
  target: string;
  actor: string;
  team: string;
  occurredAt: string;
  result: string;
  href: string;
  roles: AppRole[];
  resourceType?: string | null;
  resourceId?: string | null;
  resourceKind?: "notice" | "library" | null;
  documentRef?: string | null;
  versionLabel?: string | null;
  reason?: string | null;
};

export type WorkspacePostVersionRecord = {
  id: string;
  versionLabel: string;
  changedAt: string;
  changedBy: string;
  team: string;
  changeType: "create" | "edit" | "publish" | "restore";
  note?: string | null;
};

export type WorkspacePostAccessRecord = {
  id: string;
  action: "view" | "ref-copy";
  actor: string;
  team: string;
  occurredAt: string;
};

export type WorkspacePostRecord = {
  id: string;
  title: string;
  owner: string;
  updatedAt: string;
  status: string;
  kind: "notice" | "library";
  href: string;
  roles: AppRole[];
  linkedMenuHref?: string | null;
  linkedMenuLabel?: string | null;
  linkedPermission?: KnownPermissionCode | null;
  documentRef?: string | null;
  archivedFromStatus?: string | null;
  versionLabel?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
  refCopyCount?: number;
};

export type ApprovalTaskRecord = {
  id: string;
  title: string;
  owner: string;
  updatedAt: string;
  status: string;
  href: string;
  roles: AppRole[];
  resourceType?: string | null;
  resourceId?: string | null;
  resourceKind?: "notice" | "library" | null;
  documentRef?: string | null;
  versionLabel?: string | null;
};

export type AuditLogRecord = {
  id: string;
  eventCode: string;
  actor: string;
  resource: string;
  route: string;
  ipAddress: string;
  occurredAt: string;
  result: string;
  roles: AppRole[];
};

export type WorkspaceOwnerOption = {
  label: string;
  value: string;
};
