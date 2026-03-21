import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAnyApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import { hasPermission } from "@/lib/navigation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("commissioning.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("commissioning_packages").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "패키지를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyApiActionPermission([
    "commissioning-package.update",
    "commissioning-package.approve",
  ]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "ID 형식이 올바르지 않습니다." }, { status: 400 });
    const db = await getMongoDb();
    const existingDoc = await db.collection("commissioning_packages").findOne({ _id: new ObjectId(id) });
    if (!existingDoc) return NextResponse.json({ ok: false, message: "패키지를 찾을 수 없습니다." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const requestedStatus = typeof body.status === "string" ? body.status.trim() : "";
    const currentStatus = typeof existingDoc.status === "string" ? existingDoc.status.trim() : "";
    const requiredPermission =
      requestedStatus && requestedStatus !== currentStatus
        ? "commissioning-package.approve"
        : "commissioning-package.update";

    if (!hasPermission(auth.profile.permissions, requiredPermission)) {
      return NextResponse.json({ ok: false, message: "해당 API 접근 권한이 없습니다." }, { status: 403 });
    }

    const allowed = ["subsystemName", "description", "status", "projectSnapshot", "unitSnapshot", "systemSnapshot", "punchItems", "testItems", "turnover"];
    const fields: Record<string, unknown> = {};
    for (const key of allowed) { if (key in body) fields[key] = body[key]; }
    fields.updatedAt = new Date().toISOString();
    fields.updatedBy = buildActorSnapshot(auth.profile);
    const result = await db.collection("commissioning_packages").updateOne({ _id: new ObjectId(id) }, { $set: fields });
    if (result.matchedCount === 0) return NextResponse.json({ ok: false, message: "패키지를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, affectedCount: result.modifiedCount });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
