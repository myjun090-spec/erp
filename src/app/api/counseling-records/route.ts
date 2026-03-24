import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["draft", "completed"]);
const allowedSessionTypes = new Set(["대면", "전화", "가정방문", "온라인"]);

async function generateCounselingNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `CR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("counseling_records")
    .find({ counselingNo: { $regex: `^${prefix}` } })
    .sort({ counselingNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) return `${prefix}-0001`;
  const seq = parseInt((lastDoc[0].counselingNo as string).split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("counseling_records")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      counselingNo: doc.counselingNo,
      clientSnapshot: doc.clientSnapshot,
      sessionDate: doc.sessionDate,
      sessionType: doc.sessionType,
      duration: doc.duration,
      counselorSnapshot: doc.counselorSnapshot,
      topic: doc.topic,
      status: doc.status,
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
  const auth = await requireApiActionPermission("counseling.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const sessionDate = toTrimmedString(body.sessionDate) || now.slice(0, 10);
    const sessionType = toTrimmedString(body.sessionType) || "대면";
    const duration = toNumberValue(body.duration, 30);
    const topic = toTrimmedString(body.topic);
    const content = toTrimmedString(body.content);
    const clientResponse = toTrimmedString(body.clientResponse);
    const nextPlan = toTrimmedString(body.nextPlan);
    const status = resolveStatus(body.status, "draft");

    if (!allowedSessionTypes.has(sessionType)) {
      return NextResponse.json({ ok: false, message: "상담유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object" ? body.clientSnapshot : null;
    if (!clientSnapshot) {
      return NextResponse.json({ ok: false, message: "이용자 정보는 필수입니다." }, { status: 400 });
    }

    const casePlanSnapshot = body.casePlanSnapshot && typeof body.casePlanSnapshot === "object" ? body.casePlanSnapshot : null;
    const counselingNo = await generateCounselingNo(db);
    const counselorSnapshot = buildActorSnapshot(auth.profile);

    const result = await db.collection("counseling_records").insertOne({
      counselingNo,
      clientSnapshot,
      casePlanSnapshot,
      sessionDate,
      sessionType,
      duration,
      counselorSnapshot,
      topic,
      content,
      clientResponse,
      nextPlan,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json(
      { ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
