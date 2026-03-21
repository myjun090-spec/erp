import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { generateRegulatoryActionNo } from "@/lib/document-numbers";
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
    const docs = await db.collection("regulatory_actions").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ dueDate: 1 }).limit(50).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      actionNo: doc.actionNo,
      regulator: doc.regulator,
      actionType: doc.actionType,
      subject: doc.subject,
      dueDate: doc.dueDate,
      ownerUserSnapshot: doc.ownerUserSnapshot,
      projectSnapshot: doc.projectSnapshot,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("regulatory-action.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json()) as Record<string, string>;
    const now = new Date().toISOString();
    const ownerUserSnapshot = {
      displayName: body.ownerName || auth.profile.displayName,
      orgUnitName: body.ownerOrgUnit || auth.profile.orgUnitName,
      phone: body.ownerPhone || "",
      email: body.ownerEmail || auth.profile.email,
    };
    const rest = { ...body };
    delete rest.ownerName;
    delete rest.ownerOrgUnit;
    delete rest.ownerPhone;
    delete rest.ownerEmail;
    const result = await db.collection("regulatory_actions").insertOne({
      ...rest,
      actionNo: body.actionNo || generateRegulatoryActionNo(),
      ownerUserSnapshot,
      status: resolveStatus(body.status, "open"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
