import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("quality.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("inspections").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "검사를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("inspection.update");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "ID 형식이 올바르지 않습니다." }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const allowed = ["inspectionType", "inspectionDate", "result", "holdPoint", "description", "status", "projectSnapshot", "systemSnapshot"];
    const fields: Record<string, unknown> = {};
    for (const key of allowed) { if (key in body) fields[key] = body[key]; }
    if ("holdPoint" in fields) fields.holdPoint = Boolean(fields.holdPoint);
    fields.updatedAt = new Date().toISOString();
    fields.updatedBy = buildActorSnapshot(auth.profile);
    const db = await getMongoDb();
    const result = await db.collection("inspections").updateOne({ _id: new ObjectId(id) }, { $set: fields });
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, message: "검사를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, affectedCount: result.modifiedCount });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("inspection.archive");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "ID 형식이 올바르지 않습니다." }, { status: 400 });
    const db = await getMongoDb();
    const result = await db.collection("inspections").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "archived", updatedAt: new Date().toISOString(), updatedBy: buildActorSnapshot(auth.profile) } }
    );
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, message: "검사를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
