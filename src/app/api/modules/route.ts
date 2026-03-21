import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("manufacturing.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({ email: auth.profile.email, role: auth.profile.role });
    const docs = await db.collection("modules").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray();
    const items = docs.map(d => ({ _id: d._id.toString(), moduleNo: d.moduleNo, moduleType: d.moduleType, serialNo: d.serialNo, status: d.status, projectSnapshot: d.projectSnapshot ?? null, systemSnapshot: d.systemSnapshot ?? null, manufacturerSnapshot: d.manufacturerSnapshot ?? null }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("module.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const result = await db.collection("modules").insertOne({ ...body, status: resolveStatus(body.status, "planned"), ...buildCreateMetadata(auth.profile, now) });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
