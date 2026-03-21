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
    const doc = await db.collection("itps").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "ITP를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("itp.update");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "ID 형식이 올바르지 않습니다." }, { status: 400 });
    const body = await request.json() as Record<string, unknown>;
    const allowed = ["name", "revisionNo", "projectSnapshot", "systemSnapshot", "approvalStatus", "status"];
    const fields: Record<string, unknown> = {};
    for (const key of allowed) { if (key in body) fields[key] = body[key]; }
    fields.updatedAt = new Date().toISOString();
    fields.updatedBy = buildActorSnapshot(auth.profile);
    const db = await getMongoDb();
    const result = await db.collection("itps").updateOne({ _id: new ObjectId(id) }, { $set: fields });
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, message: "ITP를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, affectedCount: result.modifiedCount });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
