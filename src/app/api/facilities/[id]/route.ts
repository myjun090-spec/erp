import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { requireApiPermission } from "@/lib/api-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const db = await getMongoDb();
  const doc = await db.collection("facilities").findOne({ _id: new ObjectId(id) });

  if (!doc) {
    return NextResponse.json({ ok: false, message: "시설을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    source: "database",
    data: { ...doc, _id: doc._id.toString() },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiPermission("admin.write");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const now = new Date().toISOString();
  const db = await getMongoDb();

  const updateFields: Record<string, unknown> = {};
  const allowedFields = ["name", "facilityType", "address", "zipCode", "phone", "fax", "capacity", "representativeName", "directorName", "operatingOrg", "status"];
  for (const f of allowedFields) {
    if (body[f] !== undefined) updateFields[f] = body[f];
  }
  updateFields.updatedAt = now;

  await db.collection("facilities").updateOne(
    { _id: new ObjectId(id) },
    { $set: updateFields, $inc: { documentVersion: 1 } },
  );

  return NextResponse.json({ ok: true, action: "update", affectedCount: 1, targetIds: [id] });
}
