import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("work-log.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("work_logs").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      workLogNo: doc.workLogNo,
      staffSnapshot: doc.staffSnapshot,
      weekStartDate: doc.weekStartDate,
      weekEndDate: doc.weekEndDate,
      dailyEntries: doc.dailyEntries,
      weeklyGoals: doc.weeklyGoals,
      achievements: doc.achievements,
      nextWeekPlan: doc.nextWeekPlan,
      submittedAt: doc.submittedAt,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("work-log.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "work_logs" as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `WL-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const workLogNo = body.workLogNo ?? null;
    const staffSnapshot = body.staffSnapshot ?? null;
    const weekStartDate = body.weekStartDate ?? null;
    const weekEndDate = body.weekEndDate ?? null;
    const dailyEntries = body.dailyEntries ?? null;
    const weeklyGoals = body.weeklyGoals ?? null;
    const achievements = body.achievements ?? null;
    const nextWeekPlan = body.nextWeekPlan ?? null;
    const submittedAt = body.submittedAt ?? null;
    const status = body.status ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("work_logs").insertOne({
      ...{ docNo: docNo },
      workLogNo,
      staffSnapshot,
      weekStartDate,
      weekEndDate,
      dailyEntries,
      weeklyGoals,
      achievements,
      nextWeekPlan,
      submittedAt,
      status,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
