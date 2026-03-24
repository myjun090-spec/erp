import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["enrolled", "withdrawn", "completed"]);

export async function GET(request: Request) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;

    const docs = await db.collection("program_participants").find(filter).sort({ enrollmentDate: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      programSnapshot: doc.programSnapshot,
      clientSnapshot: doc.clientSnapshot,
      enrollmentDate: doc.enrollmentDate,
      attendanceRate: doc.attendanceRate,
      status: doc.status,
    }));

    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("participant.enroll");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const status = resolveStatus(body.status, "enrolled");

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "참여자 상태가 올바르지 않습니다." }, { status: 400 });
    }

    const programSnapshot = body.programSnapshot && typeof body.programSnapshot === "object" ? body.programSnapshot : null;
    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object" ? body.clientSnapshot : null;
    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object" ? body.facilitySnapshot : null;

    const result = await db.collection("program_participants").insertOne({
      programSnapshot,
      clientSnapshot,
      enrollmentDate: toTrimmedString(body.enrollmentDate),
      attendanceRecords: Array.isArray(body.attendanceRecords) ? body.attendanceRecords : [],
      attendanceRate: toNumberValue(body.attendanceRate),
      facilitySnapshot,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
