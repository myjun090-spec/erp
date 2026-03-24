import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["active", "inactive", "transferred", "deceased"]);
const allowedRegistrationTypes = new Set(["신규", "재등록", "의뢰"]);
const allowedCareLevels = new Set(["1등급", "2등급", "3등급", "4등급", "5등급", "인지지원등급", "해당없음"]);
const allowedIncomeLevels = new Set(["기초생활", "차상위", "일반"]);

async function generateClientNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `CL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("clients")
    .find({ clientNo: { $regex: `^${prefix}` } })
    .sort({ clientNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) {
    return `${prefix}-0001`;
  }

  const lastNo = lastDoc[0].clientNo as string;
  const seq = parseInt(lastNo.split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET(request: Request) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = {};
    if (facilityId) {
      filter["facilitySnapshot.facilityId"] = facilityId;
    }

    const docs = await db
      .collection("clients")
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      clientNo: doc.clientNo,
      name: doc.name,
      birthDate: doc.birthDate,
      gender: doc.gender,
      phone: doc.phone,
      address: doc.address,
      registrationDate: doc.registrationDate,
      registrationType: doc.registrationType,
      careLevel: doc.careLevel,
      incomeLevel: doc.incomeLevel,
      status: doc.status,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("client.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const name = toTrimmedString(body.name);
    const birthDate = toTrimmedString(body.birthDate);
    const gender = toTrimmedString(body.gender);
    const phone = toTrimmedString(body.phone);
    const address = toTrimmedString(body.address);
    const registrationDate = toTrimmedString(body.registrationDate) || now.slice(0, 10);
    const registrationType = toTrimmedString(body.registrationType) || "신규";
    const careLevel = toTrimmedString(body.careLevel) || "해당없음";
    const incomeLevel = toTrimmedString(body.incomeLevel) || "일반";
    const status = resolveStatus(body.status, "active");

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "이용자 이름은 필수입니다." },
        { status: 400 },
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { ok: false, message: "이용자 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (registrationType && !allowedRegistrationTypes.has(registrationType)) {
      return NextResponse.json(
        { ok: false, message: "등록유형이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (careLevel && !allowedCareLevels.has(careLevel)) {
      return NextResponse.json(
        { ok: false, message: "돌봄등급이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (incomeLevel && !allowedIncomeLevels.has(incomeLevel)) {
      return NextResponse.json(
        { ok: false, message: "소득수준이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const clientNo = await generateClientNo(db);
    const familyInfo = Array.isArray(body.familyInfo) ? body.familyInfo : [];
    const disabilityInfo = body.disabilityInfo && typeof body.disabilityInfo === "object"
      ? body.disabilityInfo
      : { hasDisability: false, disabilityType: "", disabilityGrade: "", registrationNo: "" };

    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object"
      ? body.facilitySnapshot
      : null;

    const primaryWorkerSnapshot = buildActorSnapshot(auth.profile);

    const result = await db.collection("clients").insertOne({
      clientNo,
      name,
      birthDate,
      gender,
      phone,
      address,
      registrationDate,
      registrationType,
      familyInfo,
      disabilityInfo,
      careLevel,
      incomeLevel,
      primaryWorkerSnapshot,
      facilitySnapshot,
      status,
      changeHistory: [],
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json(
      {
        ok: true,
        action: "create",
        affectedCount: 1,
        targetIds: [result.insertedId.toString()],
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
