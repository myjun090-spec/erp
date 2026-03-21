import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("quality.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const [itps, inspections, ncrs, hse] = await Promise.all([
      db.collection("itps").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
      db.collection("inspections").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ inspectionDate: -1 }).toArray(),
      db.collection("ncrs").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
      db.collection("hse_incidents").find(buildProjectFilter(projectId, {}, projectAccessScope.allowedProjectIds)).sort({ occurredAt: -1 }).toArray(),
    ]);
    return NextResponse.json({ ok: true, source: "database", data: {
      itps: itps.map(d => ({ ...d, _id: d._id.toString() })),
      inspections: inspections.map(d => ({ ...d, _id: d._id.toString() })),
      ncrs: ncrs.map(d => ({ ...d, _id: d._id.toString() })),
      hseIncidents: hse.map(d => ({ ...d, _id: d._id.toString() })),
    }, meta: { total: itps.length + inspections.length + ncrs.length + hse.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
