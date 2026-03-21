import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("commissioning.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const [packages, regulatory] = await Promise.all([
      db.collection("commissioning_packages").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
      db.collection("regulatory_actions").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ dueDate: 1 }).toArray(),
    ]);
    return NextResponse.json({ ok: true, source: "database", data: {
      packages: packages.map(d => ({ ...d, _id: d._id.toString() })),
      regulatoryActions: regulatory.map(d => ({ ...d, _id: d._id.toString() })),
    }, meta: { total: packages.length + regulatory.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
