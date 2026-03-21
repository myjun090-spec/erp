import {
  getRequiredPermissionForPath,
  getSearchableRouteItems,
} from "@/lib/navigation";
import type { KnownPermissionCode } from "@/lib/permission-catalog";
import type { WorkspacePostRecord } from "@/lib/platform-catalog";

export type WorkspaceTab = "notice" | "library" | "approvals";
export type WorkspaceMenuOption = {
  label: string;
  value: string;
  permission: KnownPermissionCode | null;
};

export function normalizeWorkspaceTab(value: string | null | undefined): WorkspaceTab | null {
  if (value === "notice" || value === "library" || value === "approvals") {
    return value;
  }

  return null;
}

export function buildWorkspaceTabHref(tab: WorkspaceTab) {
  if (tab === "notice") {
    return "/workspace";
  }

  return `/workspace?tab=${tab}`;
}

export function buildWorkspacePostDetailHref(
  kind: WorkspacePostRecord["kind"],
  postId: string,
) {
  return `/workspace/${kind}/${postId}`;
}

export function buildWorkspaceMenuOptions(permissions: ReadonlyArray<string>): WorkspaceMenuOption[] {
  return getSearchableRouteItems(permissions).map((item) => ({
    label: `${item.title} · ${item.caption}`,
    value: item.href,
    permission: getRequiredPermissionForPath(item.href) as KnownPermissionCode | null,
  }));
}
