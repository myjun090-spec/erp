import { NextResponse } from "next/server";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildCreateMetadata } from "@/lib/domain-write";

export async function GET() {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("ops_staff")
      .find({ isActive: true })
      .sort({ name: 1 })
      .limit(100)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      role: doc.role,
      department: doc.department,
      skills: doc.skills ?? [],
      schedule: doc.schedule ?? [],
      phone: doc.phone ?? "",
      isActive: doc.isActive ?? true,
      currentLoad: doc.currentLoad ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("ops-staff.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const now = new Date().toISOString();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const department = typeof body.department === "string" ? body.department.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const skills = Array.isArray(body.skills) ? body.skills : [];
    const schedule = Array.isArray(body.schedule) ? body.schedule : [];

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "이름은 필수입니다." },
        { status: 400 },
      );
    }

    const result = await db.collection("ops_staff").insertOne({
      name,
      email,
      role,
      department,
      phone,
      skills,
      schedule,
      isActive: true,
      currentLoad: 0,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json(
      { ok: true, data: { _id: result.insertedId.toString() } },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
