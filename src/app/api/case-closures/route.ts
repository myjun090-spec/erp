import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["draft", "submitted", "approved", "rejected"]);
const allowedClosureReasons = new Set(["목표달성", "의뢰인요청", "전출", "사망", "기타"]);

async function generateClosureNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `CC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("case_closures")
    .find({ closureNo: { $regex: `^${prefix}` } })
    .sort({ closureNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) return `${prefix}-0001`;
  const seq = parseInt((lastDoc[0].closureNo as string).split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("case_closures")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      closureNo: doc.closureNo,
      clientSnapshot: doc.clientSnapshot,
      closureDate: doc.closureDate,
      closureReason: doc.closureReason,
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
  const auth = await requireApiActionPermission("case-closure.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const closureDate = toTrimmedString(body.closureDate) || now.slice(0, 10);
    const closureReason = toTrimmedString(body.closureReason) || "목표달성";
    const achievementSummary = toTrimmedString(body.achievementSummary);
    const followUpPlan = toTrimmedString(body.followUpPlan);
    const followUpEndDate = toTrimmedString(body.followUpEndDate);
    const status = resolveStatus(body.status, "draft");

    if (!allowedClosureReasons.has(closureReason)) {
      return NextResponse.json({ ok: false, message: "종결사유가 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object" ? body.clientSnapshot : null;
    if (!clientSnapshot) {
      return NextResponse.json({ ok: false, message: "이용자 정보는 필수입니다." }, { status: 400 });
    }

    const casePlanSnapshot = body.casePlanSnapshot && typeof body.casePlanSnapshot === "object" ? body.casePlanSnapshot : null;
    const goalEvaluations = Array.isArray(body.goalEvaluations) ? body.goalEvaluations : [];
    const closureNo = await generateClosureNo(db);

    const result = await db.collection("case_closures").insertOne({
      closureNo,
      clientSnapshot,
      casePlanSnapshot,
      closureDate,
      closureReason,
      achievementSummary,
      goalEvaluations,
      followUpPlan,
      followUpEndDate,
      approverSnapshot: null,
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
