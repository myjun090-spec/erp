import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("facility-hr.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("facility_rooms").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("facility-hr.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const body = await req.json();
    const now = new Date().toISOString();
    await db.collection("facility_rooms").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...body, updatedAt: now, updatedBy: auth.profile.displayName } }
    );
    return NextResponse.json({ ok: true, action: "update", affectedCount: 1, targetIds: [id] });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
