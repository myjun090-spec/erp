import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, resolveStatus, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["scheduled", "completed", "cancelled"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "세션을 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("program_sessions").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "세션을 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("program-session.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "세션을 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("program_sessions").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "세션을 찾을 수 없습니다." }, { status: 404 });

    const body = await request.json();
    const title = toTrimmedString(body.title) || toTrimmedString(doc.title);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "scheduled");

    if (!title) return NextResponse.json({ ok: false, message: "세션 제목은 필수입니다." }, { status: 400 });
    if (!allowedStatuses.has(status)) return NextResponse.json({ ok: false, message: "세션 상태가 올바르지 않습니다." }, { status: 400 });

    const instructorSnapshot = body.instructorSnapshot !== undefined
      ? (body.instructorSnapshot && typeof body.instructorSnapshot === "object" ? body.instructorSnapshot : null)
      : doc.instructorSnapshot;

    const now = new Date().toISOString();
    await db.collection("program_sessions").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          sessionNumber: body.sessionNumber !== undefined ? toNumberValue(body.sessionNumber) : doc.sessionNumber,
          sessionDate: body.sessionDate !== undefined ? toTrimmedString(body.sessionDate) : doc.sessionDate,
          startTime: body.startTime !== undefined ? toTrimmedString(body.startTime) : doc.startTime,
          endTime: body.endTime !== undefined ? toTrimmedString(body.endTime) : doc.endTime,
          location: body.location !== undefined ? toTrimmedString(body.location) : doc.location,
          instructorSnapshot,
          content: body.content !== undefined ? toTrimmedString(body.content) : doc.content,
          attendeeCount: body.attendeeCount !== undefined ? toNumberValue(body.attendeeCount) : doc.attendeeCount,
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
