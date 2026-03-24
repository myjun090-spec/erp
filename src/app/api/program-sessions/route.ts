import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { generateSessionNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["scheduled", "completed", "cancelled"]);

export async function GET(request: Request) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;

    const docs = await db.collection("program_sessions").find(filter).sort({ sessionDate: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      sessionNo: doc.sessionNo,
      programSnapshot: doc.programSnapshot,
      sessionNumber: doc.sessionNumber,
      title: doc.title,
      sessionDate: doc.sessionDate,
      startTime: doc.startTime,
      endTime: doc.endTime,
      attendeeCount: doc.attendeeCount,
      status: doc.status,
    }));

    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("program-session.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const title = toTrimmedString(body.title);
    const status = resolveStatus(body.status, "scheduled");

    if (!title) {
      return NextResponse.json({ ok: false, message: "세션 제목은 필수입니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "세션 상태가 올바르지 않습니다." }, { status: 400 });
    }

    const programSnapshot = body.programSnapshot && typeof body.programSnapshot === "object" ? body.programSnapshot : null;
    const instructorSnapshot = body.instructorSnapshot && typeof body.instructorSnapshot === "object" ? body.instructorSnapshot : null;
    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object" ? body.facilitySnapshot : null;

    const result = await db.collection("program_sessions").insertOne({
      sessionNo: generateSessionNo(),
      programSnapshot,
      sessionNumber: toNumberValue(body.sessionNumber),
      title,
      sessionDate: toTrimmedString(body.sessionDate),
      startTime: toTrimmedString(body.startTime),
      endTime: toTrimmedString(body.endTime),
      location: toTrimmedString(body.location),
      instructorSnapshot,
      content: toTrimmedString(body.content),
      attendeeCount: toNumberValue(body.attendeeCount),
      facilitySnapshot,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
