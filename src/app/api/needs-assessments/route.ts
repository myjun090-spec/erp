import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
  toNumberValue,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["draft", "completed", "archived"]);
const allowedAssessmentTypes = new Set(["초기", "재사정", "긴급"]);
const allowedDomains = new Set(["건강", "일상생활", "사회관계", "경제", "가족", "주거환경"]);

async function generateAssessmentNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `NA-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("needs_assessments")
    .find({ assessmentNo: { $regex: `^${prefix}` } })
    .sort({ assessmentNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) return `${prefix}-0001`;
  const seq = parseInt((lastDoc[0].assessmentNo as string).split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("needs_assessments")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      assessmentNo: doc.assessmentNo,
      clientSnapshot: doc.clientSnapshot,
      assessmentDate: doc.assessmentDate,
      assessorSnapshot: doc.assessorSnapshot,
      assessmentType: doc.assessmentType,
      overallScore: doc.overallScore,
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
  const auth = await requireApiActionPermission("needs-assessment.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const assessmentDate = toTrimmedString(body.assessmentDate) || now.slice(0, 10);
    const assessmentType = toTrimmedString(body.assessmentType) || "초기";
    const specialNotes = toTrimmedString(body.specialNotes);
    const status = resolveStatus(body.status, "draft");

    if (!allowedAssessmentTypes.has(assessmentType)) {
      return NextResponse.json({ ok: false, message: "사정유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object"
      ? body.clientSnapshot
      : null;

    if (!clientSnapshot) {
      return NextResponse.json({ ok: false, message: "이용자 정보는 필수입니다." }, { status: 400 });
    }

    const domains = Array.isArray(body.domains)
      ? body.domains.map((d: Record<string, unknown>) => ({
          domainName: toTrimmedString(d.domainName),
          currentStatus: toTrimmedString(d.currentStatus),
          score: Math.min(5, Math.max(1, toNumberValue(d.score, 1))),
          needs: toTrimmedString(d.needs),
          priority: toTrimmedString(d.priority),
        })).filter((d: { domainName: string }) => allowedDomains.has(d.domainName))
      : [];

    const overallScore = domains.length > 0
      ? Math.round(domains.reduce((sum: number, d: { score: number }) => sum + d.score, 0) / domains.length * 10) / 10
      : 0;

    const assessmentNo = await generateAssessmentNo(db);
    const assessorSnapshot = buildActorSnapshot(auth.profile);

    const result = await db.collection("needs_assessments").insertOne({
      assessmentNo,
      clientSnapshot,
      assessmentDate,
      assessorSnapshot,
      assessmentType,
      domains,
      overallScore,
      specialNotes,
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
