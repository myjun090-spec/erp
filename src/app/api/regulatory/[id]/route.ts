import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("commissioning.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("regulatory_actions").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "규제대응을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("regulatory-action.update");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "ID 형식이 올바르지 않습니다." }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const allowed = ["regulator", "actionType", "subject", "dueDate", "responseDate", "status", "ownerUserSnapshot", "relatedDocumentRefs"];
    const fields: Record<string, unknown> = {};
    for (const key of allowed) { if (key in body) fields[key] = body[key]; }
    // ownerName/ownerOrgUnit/ownerPhone/ownerEmail → ownerUserSnapshot 조립
    if ("ownerName" in body || "ownerOrgUnit" in body || "ownerPhone" in body || "ownerEmail" in body) {
      fields.ownerUserSnapshot = {
        displayName: (body.ownerName as string) || auth.profile.displayName,
        orgUnitName: (body.ownerOrgUnit as string) || auth.profile.orgUnitName,
        phone: (body.ownerPhone as string) || "",
        email: (body.ownerEmail as string) || auth.profile.email,
      };
    }
    fields.updatedAt = new Date().toISOString();
    fields.updatedBy = buildActorSnapshot(auth.profile);
    const db = await getMongoDb();
    const result = await db.collection("regulatory_actions").updateOne({ _id: new ObjectId(id) }, { $set: fields });
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, message: "규제대응을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, affectedCount: result.modifiedCount });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
