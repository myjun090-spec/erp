import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

type WbsListItem = {
  _id: string;
  code: string;
  name: string;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  unitSnapshot: {
    unitId: string;
    unitNo: string;
  } | null;
  systemSnapshot: {
    systemId: string;
    code: string;
    name: string;
  } | null;
  discipline: string;
  costCategory: string;
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
      .collection("wbs_items")
      .find(
        buildProjectFilter(
          projectId,
          { status: { $ne: "archived" } },
          projectAccessScope.allowedProjectIds,
        ),
      )
      .sort({ "projectSnapshot.code": 1, code: 1, updatedAt: -1 })
      .limit(200)
      .toArray();

    const items: WbsListItem[] = docs.map((doc) => ({
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
      unitSnapshot:
        doc.unitSnapshot && typeof doc.unitSnapshot === "object"
          ? {
              unitId: String((doc.unitSnapshot as Record<string, unknown>).unitId ?? ""),
              unitNo: String((doc.unitSnapshot as Record<string, unknown>).unitNo ?? ""),
            }
          : null,
      systemSnapshot:
        doc.systemSnapshot && typeof doc.systemSnapshot === "object"
          ? {
              systemId: String((doc.systemSnapshot as Record<string, unknown>).systemId ?? ""),
              code: String((doc.systemSnapshot as Record<string, unknown>).code ?? ""),
              name: String((doc.systemSnapshot as Record<string, unknown>).name ?? ""),
            }
          : null,
      discipline: typeof doc.discipline === "string" ? doc.discipline : "",
      costCategory: typeof doc.costCategory === "string" ? doc.costCategory : "direct",
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
    } satisfies DomainApiSuccessEnvelope<{ items: WbsListItem[] }>);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
