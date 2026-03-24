import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["draft", "submitted", "approved", "rejected", "in-progress", "completed", "terminated"]);

async function generatePlanNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `CP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("case_plans")
    .find({ planNo: { $regex: `^${prefix}` } })
    .sort({ planNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) return `${prefix}-0001`;
  const seq = parseInt((lastDoc[0].planNo as string).split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("case_plans")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      planNo: doc.planNo,
      clientSnapshot: doc.clientSnapshot,
      planDate: doc.planDate,
      startDate: doc.startDate,
      endDate: doc.endDate,
      planWorkerSnapshot: doc.planWorkerSnapshot,
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
  const auth = await requireApiActionPermission("case-plan.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const planDate = toTrimmedString(body.planDate) || now.slice(0, 10);
    const startDate = toTrimmedString(body.startDate);
    const endDate = toTrimmedString(body.endDate);
    const status = resolveStatus(body.status, "draft");

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object" ? body.clientSnapshot : null;
    if (!clientSnapshot) {
      return NextResponse.json({ ok: false, message: "이용자 정보는 필수입니다." }, { status: 400 });
    }

    const assessmentSnapshot = body.assessmentSnapshot && typeof body.assessmentSnapshot === "object" ? body.assessmentSnapshot : null;
    const goals = Array.isArray(body.goals) ? body.goals : [];
    const planNo = await generatePlanNo(db);
    const planWorkerSnapshot = buildActorSnapshot(auth.profile);

    const result = await db.collection("case_plans").insertOne({
      planNo,
      clientSnapshot,
      assessmentSnapshot,
      planDate,
      startDate,
      endDate,
      goals,
      planWorkerSnapshot,
      approverSnapshot: null,
      status,
      changeHistory: [],
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
