import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { generatePerformanceEvalNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";

const allowedGrades = new Set(["우수", "양호", "보통", "미흡"]);

export async function GET(request: Request) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;

    const docs = await db.collection("performance_evaluations").find(filter).sort({ evaluationDate: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      evaluationNo: doc.evaluationNo,
      programSnapshot: doc.programSnapshot,
      evaluationDate: doc.evaluationDate,
      evaluatorSnapshot: doc.evaluatorSnapshot,
      overallGrade: doc.overallGrade,
    }));

    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("performance-eval.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const overallGrade = toTrimmedString(body.overallGrade) || "보통";
    if (!allowedGrades.has(overallGrade)) {
      return NextResponse.json({ ok: false, message: "종합등급이 올바르지 않습니다." }, { status: 400 });
    }

    const programSnapshot = body.programSnapshot && typeof body.programSnapshot === "object" ? body.programSnapshot : null;
    const evaluatorSnapshot = body.evaluatorSnapshot && typeof body.evaluatorSnapshot === "object" ? body.evaluatorSnapshot : null;
    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object" ? body.facilitySnapshot : null;

    const result = await db.collection("performance_evaluations").insertOne({
      evaluationNo: generatePerformanceEvalNo(),
      programSnapshot,
      evaluationDate: toTrimmedString(body.evaluationDate),
      evaluatorSnapshot,
      inputMetrics: toTrimmedString(body.inputMetrics),
      outputMetrics: toTrimmedString(body.outputMetrics),
      outcomeMetrics: toTrimmedString(body.outcomeMetrics),
      overallGrade,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
