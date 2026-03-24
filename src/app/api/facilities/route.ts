import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { generateFacilityCode } from "@/lib/document-numbers";
import { buildCreateMetadata } from "@/lib/domain-write";

export async function GET() {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const db = await getMongoDb();
  const docs = await db
    .collection("facilities")
    .find({ status: { $ne: "closed" } })
    .sort({ name: 1 })
    .toArray();

  return NextResponse.json({
    ok: true,
    source: docs.length > 0 ? "database" : "empty",
    data: { items: docs.map((d) => ({ ...d, _id: d._id.toString() })) },
    meta: { total: docs.length },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("facility-room.create");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const { name, facilityType, address, phone, capacity, representativeName, directorName, operatingOrg } = body;

  if (!name || !facilityType) {
    return NextResponse.json({ ok: false, message: "시설명과 유형은 필수입니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = await getMongoDb();

  const doc = {
    code: generateFacilityCode(),
    name,
    facilityType,
    address: address ?? "",
    zipCode: "",
    phone: phone ?? "",
    fax: "",
    establishedDate: "",
    licensingAuthority: "",
    licenseNumber: "",
    capacity: capacity ?? 0,
    currentOccupancy: 0,
    representativeName: representativeName ?? "",
    directorName: directorName ?? "",
    operatingOrg: operatingOrg ?? "",
    status: "active",
    ...buildCreateMetadata(auth.profile, now),
  };

  const result = await db.collection("facilities").insertOne(doc);

  return NextResponse.json({
    ok: true,
    action: "create",
    affectedCount: 1,
    targetIds: [result.insertedId.toString()],
  }, { status: 201 });
}
