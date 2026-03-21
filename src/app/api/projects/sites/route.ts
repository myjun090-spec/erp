import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

type SiteListItem = {
  _id: string;
  code: string;
  name: string;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  country: string;
  siteManagerSnapshot: {
    displayName: string;
  } | null;
  status: string;
};

export async function GET(request: Request) {
  const auth = await requireApiPermission("project.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const docs = await db
      .collection("sites")
      .find(
        buildProjectFilter(
          projectId,
          { status: { $ne: "archived" } },
          projectAccessScope.allowedProjectIds,
        ),
      )
      .sort({ "projectSnapshot.code": 1, updatedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    const items: SiteListItem[] = docs.map((doc) => ({
      _id: doc._id.toString(),
      code: typeof doc.code === "string" ? doc.code : "",
      name: typeof doc.name === "string" ? doc.name : "",
      projectSnapshot:
        doc.projectSnapshot && typeof doc.projectSnapshot === "object"
          ? {
              projectId: String(
                (doc.projectSnapshot as Record<string, unknown>).projectId ?? "",
              ),
              code: String((doc.projectSnapshot as Record<string, unknown>).code ?? ""),
              name: String((doc.projectSnapshot as Record<string, unknown>).name ?? ""),
            }
          : null,
      country: typeof doc.country === "string" ? doc.country : "",
      siteManagerSnapshot:
        doc.siteManagerSnapshot && typeof doc.siteManagerSnapshot === "object"
          ? {
              displayName: String(
                (doc.siteManagerSnapshot as Record<string, unknown>).displayName ?? "",
              ),
            }
          : null,
      status: typeof doc.status === "string" ? doc.status : "active",
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: {
        total: items.length,
        defaultProjectId: projectAccessScope.defaultProjectId,
      },
    } satisfies DomainApiSuccessEnvelope<{ items: SiteListItem[] }>);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
