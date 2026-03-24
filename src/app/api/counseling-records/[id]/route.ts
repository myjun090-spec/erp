import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, resolveStatus, toTrimmedString, toNumberValue } from "@/lib/domain-write";

const allowedStatuses = new Set(["draft", "completed"]);
const allowedSessionTypes = new Set(["대면", "전화", "가정방문", "온라인"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "상담기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("counseling_records").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "상담기록을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("counseling.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "상담기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("counseling_records").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "상담기록을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const sessionDate = toTrimmedString(body.sessionDate ?? doc.sessionDate);
    const sessionType = toTrimmedString(body.sessionType ?? doc.sessionType);
    const duration = toNumberValue(body.duration, doc.duration ?? 30);
    const topic = toTrimmedString(body.topic ?? doc.topic);
    const content = toTrimmedString(body.content ?? doc.content);
    const clientResponse = toTrimmedString(body.clientResponse ?? doc.clientResponse);
    const nextPlan = toTrimmedString(body.nextPlan ?? doc.nextPlan);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "draft");

    if (!allowedSessionTypes.has(sessionType)) {
      return NextResponse.json({ ok: false, message: "상담유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("counseling_records").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          sessionDate,
          sessionType,
          duration,
          topic,
          content,
          clientResponse,
          nextPlan,
          status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
