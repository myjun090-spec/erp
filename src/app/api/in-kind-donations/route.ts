import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("donation-volunteer.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("in_kind_donations").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      donationNo: doc.donationNo,
      donorSnapshot: doc.donorSnapshot,
      itemName: doc.itemName,
      quantity: doc.quantity,
      estimatedValue: doc.estimatedValue,
      distributedTo: doc.distributedTo,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("donation.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "in_kind_donations" as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `IKD-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const donationNo = body.donationNo ?? null;
    const donorSnapshot = body.donorSnapshot ?? null;
    const itemName = body.itemName ?? null;
    const quantity = body.quantity ?? null;
    const estimatedValue = body.estimatedValue ?? null;
    const distributedTo = body.distributedTo ?? null;
    const status = body.status ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("in_kind_donations").insertOne({
      ...{ docNo: docNo },
      donationNo,
      donorSnapshot,
      itemName,
      quantity,
      estimatedValue,
      distributedTo,
      status,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
