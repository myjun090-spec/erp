import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireAnyApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, resolveStatus, toNumberValue } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["enrolled", "withdrawn", "completed"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "참여자를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("program_participants").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "참여자를 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyApiActionPermission(["participant.enroll", "participant.withdraw"]);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "참여자를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("program_participants").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "참여자를 찾을 수 없습니다." }, { status: 404 });

    const body = await request.json();
    const status = resolveStatus(body.status, doc.status || "enrolled");

    if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, message: "참여자 상태가 올바르지 않습니다." }, { status: 400 });

    const now = new Date().toISOString();
    await db.collection("program_participants").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          attendanceRate: body.attendanceRate !== undefined ? toNumberValue(body.attendanceRate) : doc.attendanceRate,
          status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
