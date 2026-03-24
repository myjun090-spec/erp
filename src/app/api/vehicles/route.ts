import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("facility-hr.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("vehicles").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      vehicleNo: doc.vehicleNo,
      licensePlate: doc.licensePlate,
      vehicleType: doc.vehicleType,
      purpose: doc.purpose,
      maintenanceLogs: doc.maintenanceLogs,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("vehicle.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "vehicles" as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `VEH-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const vehicleNo = body.vehicleNo ?? null;
    const licensePlate = body.licensePlate ?? null;
    const vehicleType = body.vehicleType ?? null;
    const purpose = body.purpose ?? null;
    const maintenanceLogs = body.maintenanceLogs ?? null;
    const status = body.status ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("vehicles").insertOne({
      ...{ docNo: docNo },
      vehicleNo,
      licensePlate,
      vehicleType,
      purpose,
      maintenanceLogs,
      status,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
