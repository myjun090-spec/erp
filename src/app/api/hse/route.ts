import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { generateIncidentNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("safety.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({ email: auth.profile.email, role: auth.profile.role });
    const docs = await db.collection("hse_incidents")
      .find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds))
      .sort({ occurredAt: -1 }).limit(50).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      incidentNo: doc.incidentNo,
      incidentType: doc.incidentType,
      severity: doc.severity,
      title: doc.title,
      occurredAt: doc.occurredAt,
      siteSnapshot: doc.siteSnapshot ?? null,
      status: doc.status,
      ownerUserSnapshot: doc.ownerUserSnapshot,
      projectSnapshot: doc.projectSnapshot,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("hse.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const ownerUserSnapshot = {
      displayName: (body.ownerName as string) || auth.profile.displayName,
      orgUnitName: (body.ownerOrgUnit as string) || auth.profile.orgUnitName,
      phone: (body.ownerPhone as string) || "",
      email: (body.ownerEmail as string) || auth.profile.email,
    };
    const rest = { ...body };
    delete rest.ownerName;
    delete rest.ownerOrgUnit;
    delete rest.ownerPhone;
    delete rest.ownerEmail;
    const result = await db.collection("hse_incidents").insertOne({
      ...rest,
      incidentNo: (body.incidentNo as string) || generateIncidentNo(),
      ownerUserSnapshot,
      correctiveActions: (body.correctiveActions as unknown[]) ?? [],
      status: resolveStatus(body.status as string, "open"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
