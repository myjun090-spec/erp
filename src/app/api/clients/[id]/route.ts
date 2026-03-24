import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, resolveStatus, toTrimmedString } from "@/lib/domain-write";

const allowedStatuses = new Set(["active", "inactive", "transferred", "deceased"]);
const allowedRegistrationTypes = new Set(["신규", "재등록", "의뢰"]);
const allowedCareLevels = new Set(["1등급", "2등급", "3등급", "4등급", "5등급", "인지지원등급", "해당없음"]);
const allowedIncomeLevels = new Set(["기초생활", "차상위", "일반"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "이용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("clients").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "이용자를 찾을 수 없습니다." }, { status: 404 });
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
  const auth = await requireApiActionPermission("client.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "이용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("clients").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "이용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const name = toTrimmedString(body.name || doc.name);
    const birthDate = toTrimmedString(body.birthDate ?? doc.birthDate);
    const gender = toTrimmedString(body.gender ?? doc.gender);
    const phone = toTrimmedString(body.phone ?? doc.phone);
    const address = toTrimmedString(body.address ?? doc.address);
    const registrationDate = toTrimmedString(body.registrationDate ?? doc.registrationDate);
    const registrationType = toTrimmedString(body.registrationType ?? doc.registrationType);
    const careLevel = toTrimmedString(body.careLevel ?? doc.careLevel);
    const incomeLevel = toTrimmedString(body.incomeLevel ?? doc.incomeLevel);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "active");

    if (!name) {
      return NextResponse.json({ ok: false, message: "이용자 이름은 필수입니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "이용자 상태가 올바르지 않습니다." }, { status: 400 });
    }

    if (registrationType && !allowedRegistrationTypes.has(registrationType)) {
      return NextResponse.json({ ok: false, message: "등록유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (careLevel && !allowedCareLevels.has(careLevel)) {
      return NextResponse.json({ ok: false, message: "돌봄등급이 올바르지 않습니다." }, { status: 400 });
    }

    if (incomeLevel && !allowedIncomeLevels.has(incomeLevel)) {
      return NextResponse.json({ ok: false, message: "소득수준이 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("clients").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          birthDate,
          gender,
          phone,
          address,
          registrationDate,
          registrationType,
          careLevel,
          incomeLevel,
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
