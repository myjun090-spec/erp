import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getAdminCatalogFromStore } from "@/lib/admin-store";
import { getAuditLogsFromStore } from "@/lib/platform-store";

export async function GET() {
  const result = await requireApiPermission("admin.read");

  if ("error" in result) {
    return result.error;
  }

  const [catalogResult, auditResult] = await Promise.all([
    getAdminCatalogFromStore(),
    getAuditLogsFromStore(result.profile.role),
  ]);

  return NextResponse.json({
    viewer: {
      role: result.profile.role,
      displayName: result.profile.displayName,
      orgUnitName: result.profile.orgUnitName,
    },
    catalog: catalogResult.catalog,
    auditLogs: auditResult.auditLogs,
    source: catalogResult.source,
    error: catalogResult.error ?? null,
  });
}
