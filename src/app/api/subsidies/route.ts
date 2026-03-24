import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("subsidies").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      subsidyNo: doc.subsidyNo,
      grantName: doc.grantName,
      grantingAuthority: doc.grantingAuthority,
      grantType: doc.grantType,
      fiscalYear: doc.fiscalYear,
      grantAmount: doc.grantAmount,
      receivedAmount: doc.receivedAmount,
      usedAmount: doc.usedAmount,
      reportingSchedule: doc.reportingSchedule,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("subsidy.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "subsidies" as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `GRT-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const subsidyNo = body.subsidyNo ?? null;
    const grantName = body.grantName ?? null;
    const grantingAuthority = body.grantingAuthority ?? null;
    const grantType = body.grantType ?? null;
    const fiscalYear = body.fiscalYear ?? null;
    const grantAmount = body.grantAmount ?? null;
    const receivedAmount = body.receivedAmount ?? null;
    const usedAmount = body.usedAmount ?? null;
    const reportingSchedule = body.reportingSchedule ?? null;
    const status = body.status ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("subsidies").insertOne({
      ...{ docNo: docNo },
      subsidyNo,
      grantName,
      grantingAuthority,
      grantType,
      fiscalYear,
      grantAmount,
      receivedAmount,
      usedAmount,
      reportingSchedule,
      status,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
