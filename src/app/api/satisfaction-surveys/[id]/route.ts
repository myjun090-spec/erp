import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "만족도조사를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("satisfaction_surveys").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "만족도조사를 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("satisfaction-survey.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "만족도조사를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("satisfaction_surveys").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "만족도조사를 찾을 수 없습니다." }, { status: 404 });

    const body = await request.json();
    const now = new Date().toISOString();

    await db.collection("satisfaction_surveys").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          surveyDate: body.surveyDate !== undefined ? toTrimmedString(body.surveyDate) : doc.surveyDate,
          respondentCount: body.respondentCount !== undefined ? toNumberValue(body.respondentCount) : doc.respondentCount,
          questions: Array.isArray(body.questions) ? body.questions : doc.questions,
          overallSatisfaction: body.overallSatisfaction !== undefined ? toNumberValue(body.overallSatisfaction) : doc.overallSatisfaction,
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
