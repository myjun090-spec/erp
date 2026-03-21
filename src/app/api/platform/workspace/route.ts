import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { buildWorkspaceMenuOptions } from "@/lib/workspace-navigation";
import {
  getWorkspaceOverviewFromStore,
  getWorkspaceOwnerOptionsFromStore,
} from "@/lib/platform-store";

export async function GET() {
  const result = await requireApiPermission("workspace.read");

  if ("error" in result) {
    return result.error;
  }

  const [overview, ownerOptionsResult] = await Promise.all([
    getWorkspaceOverviewFromStore(result.profile.role),
    getWorkspaceOwnerOptionsFromStore(),
  ]);

  return NextResponse.json({
    viewer: {
      role: result.profile.role,
      displayName: result.profile.displayName,
      orgUnitName: result.profile.orgUnitName,
    },
    source: overview.source,
    data: {
      notices: overview.notices,
      libraries: overview.libraries,
      approvalTasks: overview.approvalTasks,
      approvalHistory: overview.approvalHistory,
      ownerOptions: ownerOptionsResult.ownerOptions,
      menuOptions: buildWorkspaceMenuOptions(result.profile.permissions),
    },
  });
}
