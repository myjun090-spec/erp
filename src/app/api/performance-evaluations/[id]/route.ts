import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, toTrimmedString } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedGrades = new Set(["우수", "양호", "보통", "미흡"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "성과평가를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("performance_evaluations").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "성과평가를 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("performance-eval.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "성과평가를 찾을 수 없습니다." }, { status: 404 });

    const db = await getMongoDb();
    const doc = await db.collection("performance_evaluations").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "성과평가를 찾을 수 없습니다." }, { status: 404 });

    const body = await request.json();
    const overallGrade = toTrimmedString(body.overallGrade) || toTrimmedString(doc.overallGrade);

    if (overallGrade && !allowedGrades.has(overallGrade)) {
      return NextResponse.json({ ok: false, message: "종합등급이 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("performance_evaluations").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          evaluationDate: body.evaluationDate !== undefined ? toTrimmedString(body.evaluationDate) : doc.evaluationDate,
          inputMetrics: body.inputMetrics !== undefined ? toTrimmedString(body.inputMetrics) : doc.inputMetrics,
          outputMetrics: body.outputMetrics !== undefined ? toTrimmedString(body.outputMetrics) : doc.outputMetrics,
          outcomeMetrics: body.outcomeMetrics !== undefined ? toTrimmedString(body.outcomeMetrics) : doc.outcomeMetrics,
          overallGrade,
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
