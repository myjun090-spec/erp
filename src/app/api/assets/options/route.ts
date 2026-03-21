import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";

export async function GET() {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const filter =
      projectAccessScope.allowedProjectIds === null
        ? { status: { $ne: "archived" } }
        : {
            status: { $ne: "archived" },
            _id: {
              $in: projectAccessScope.allowedProjectIds
                .filter((projectId) => ObjectId.isValid(projectId))
                .map((projectId) => new ObjectId(projectId)),
            },
          };

    const projects = await db
      .collection("projects")
      .find(filter)
      .sort({ code: 1, name: 1 })
      .project({ _id: 1, code: 1, name: 1, status: 1 })
      .toArray();

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        projects: projects.map((project) => ({
          _id: project._id.toString(),
          code: String(project.code || ""),
          name: String(project.name || ""),
          status: String(project.status || ""),
        })),
      },
      meta: { total: projects.length, defaultProjectId: projectAccessScope.defaultProjectId },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
