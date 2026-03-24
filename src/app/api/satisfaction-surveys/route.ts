import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { generateSurveyNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;

    const docs = await db.collection("satisfaction_surveys").find(filter).sort({ surveyDate: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      surveyNo: doc.surveyNo,
      programSnapshot: doc.programSnapshot,
      surveyDate: doc.surveyDate,
      respondentCount: doc.respondentCount,
      overallSatisfaction: doc.overallSatisfaction,
    }));

    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("satisfaction-survey.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const programSnapshot = body.programSnapshot && typeof body.programSnapshot === "object" ? body.programSnapshot : null;
    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object" ? body.facilitySnapshot : null;

    const result = await db.collection("satisfaction_surveys").insertOne({
      surveyNo: generateSurveyNo(),
      programSnapshot,
      surveyDate: toTrimmedString(body.surveyDate),
      respondentCount: toNumberValue(body.respondentCount),
      questions: Array.isArray(body.questions) ? body.questions : [],
      overallSatisfaction: toNumberValue(body.overallSatisfaction),
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
