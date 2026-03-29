import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ops-staff.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const body = await request.json();
    const now = new Date().toISOString();

    const update: Record<string, unknown> = { updatedAt: now };
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.email === "string") update.email = body.email.trim();
    if (typeof body.role === "string") update.role = body.role.trim();
    if (typeof body.department === "string") update.department = body.department.trim();
    if (typeof body.phone === "string") update.phone = body.phone.trim();
    if (Array.isArray(body.skills)) update.skills = body.skills;
    if (Array.isArray(body.schedule)) update.schedule = body.schedule;
    if (typeof body.isActive === "boolean") update.isActive = body.isActive;

    const result = await db.collection("ops_staff").updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, message: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ops-staff.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();

    const result = await db.collection("ops_staff").updateOne(
      { _id: new ObjectId(id) },
      { $set: { isActive: false, updatedAt: new Date().toISOString() } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, message: "직원을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
