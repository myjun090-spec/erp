import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, resolveStatus, toTrimmedString, toNumberValue } from "@/lib/domain-write";

const allowedStatuses = new Set(["draft", "completed", "archived"]);
const allowedDomains = new Set(["건강", "일상생활", "사회관계", "경제", "가족", "주거환경"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "욕구사정을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("needs_assessments").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "욕구사정을 찾을 수 없습니다." }, { status: 404 });
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
  const auth = await requireApiActionPermission("needs-assessment.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "욕구사정을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("needs_assessments").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "욕구사정을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const assessmentDate = toTrimmedString(body.assessmentDate ?? doc.assessmentDate);
    const assessmentType = toTrimmedString(body.assessmentType ?? doc.assessmentType);
    const specialNotes = toTrimmedString(body.specialNotes ?? doc.specialNotes);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "draft");

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const domains = Array.isArray(body.domains)
      ? body.domains
          .map((d: Record<string, unknown>) => ({
            domainName: toTrimmedString(d.domainName),
            currentStatus: toTrimmedString(d.currentStatus),
            score: Math.min(5, Math.max(1, toNumberValue(d.score, 1))),
            needs: toTrimmedString(d.needs),
            priority: toTrimmedString(d.priority),
          }))
          .filter((d: { domainName: string }) => allowedDomains.has(d.domainName))
      : doc.domains;

    const overallScore =
      Array.isArray(domains) && domains.length > 0
        ? Math.round(
            (domains.reduce((sum: number, d: { score: number }) => sum + d.score, 0) / domains.length) * 10,
          ) / 10
        : doc.overallScore;

    const now = new Date().toISOString();
    await db.collection("needs_assessments").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          assessmentDate,
          assessmentType,
          domains,
          overallScore,
          specialNotes,
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
