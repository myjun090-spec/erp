import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, resolveStatus, toTrimmedString } from "@/lib/domain-write";

const allowedStatuses = new Set(["draft", "submitted", "approved", "rejected"]);
const allowedClosureReasons = new Set(["목표달성", "의뢰인요청", "전출", "사망", "기타"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "사례종결을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("case_closures").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "사례종결을 찾을 수 없습니다." }, { status: 404 });
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
  const auth = await requireApiActionPermission("case-closure.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "사례종결을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("case_closures").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "사례종결을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const closureDate = toTrimmedString(body.closureDate ?? doc.closureDate);
    const closureReason = toTrimmedString(body.closureReason ?? doc.closureReason);
    const achievementSummary = toTrimmedString(body.achievementSummary ?? doc.achievementSummary);
    const followUpPlan = toTrimmedString(body.followUpPlan ?? doc.followUpPlan);
    const followUpEndDate = toTrimmedString(body.followUpEndDate ?? doc.followUpEndDate);
    const goalEvaluations = Array.isArray(body.goalEvaluations) ? body.goalEvaluations : doc.goalEvaluations;
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "draft");

    if (!allowedClosureReasons.has(closureReason)) {
      return NextResponse.json({ ok: false, message: "종결사유가 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("case_closures").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          closureDate,
          closureReason,
          achievementSummary,
          goalEvaluations,
          followUpPlan,
          followUpEndDate,
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
