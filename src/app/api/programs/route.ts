import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { generateProgramNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";

const allowedCategories = new Set(["사례관리", "서비스제공", "지역조직화", "교육", "문화", "건강"]);
const allowedTargetGroups = new Set(["노인", "장애인", "아동", "가족", "지역주민"]);
const allowedStatuses = new Set(["planning", "recruiting", "in-progress", "completed", "cancelled"]);
const allowedFundingSources = new Set(["자체", "보조금", "후원금", "혼합"]);

export async function GET(request: Request) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");

    const filter: Record<string, unknown> = { status: { $ne: "cancelled" } };
    if (facilityId) {
      filter["facilitySnapshot.facilityId"] = facilityId;
    }

    const docs = await db
      .collection("programs")
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      programNo: doc.programNo,
      name: doc.name,
      category: doc.category,
      targetGroup: doc.targetGroup,
      startDate: doc.startDate,
      endDate: doc.endDate,
      totalSessions: doc.totalSessions,
      maxParticipants: doc.maxParticipants,
      currentParticipants: doc.currentParticipants,
      budget: doc.budget,
      fundingSource: doc.fundingSource,
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
  const auth = await requireApiActionPermission("program.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const name = toTrimmedString(body.name);
    const category = toTrimmedString(body.category);
    const targetGroup = toTrimmedString(body.targetGroup);
    const objectives = toTrimmedString(body.objectives);
    const startDate = toTrimmedString(body.startDate);
    const endDate = toTrimmedString(body.endDate);
    const totalSessions = toNumberValue(body.totalSessions);
    const maxParticipants = toNumberValue(body.maxParticipants);
    const budget = toNumberValue(body.budget);
    const fundingSource = toTrimmedString(body.fundingSource) || "자체";
    const status = resolveStatus(body.status, "planning");

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "프로그램명은 필수입니다." },
        { status: 400 },
      );
    }

    if (category && !allowedCategories.has(category)) {
      return NextResponse.json(
        { ok: false, message: "프로그램 분류가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (targetGroup && !allowedTargetGroups.has(targetGroup)) {
      return NextResponse.json(
        { ok: false, message: "대상 그룹이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { ok: false, message: "프로그램 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (fundingSource && !allowedFundingSources.has(fundingSource)) {
      return NextResponse.json(
        { ok: false, message: "재원이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const managerSnapshot = body.managerSnapshot && typeof body.managerSnapshot === "object"
      ? body.managerSnapshot
      : null;

    const facilitySnapshot = body.facilitySnapshot && typeof body.facilitySnapshot === "object"
      ? body.facilitySnapshot
      : null;

    const result = await db.collection("programs").insertOne({
      programNo: generateProgramNo(),
      name,
      category,
      targetGroup,
      objectives,
      startDate,
      endDate,
      totalSessions,
      maxParticipants,
      currentParticipants: 0,
      budget,
      fundingSource,
      managerSnapshot,
      facilitySnapshot,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json(
      { ok: true, data: { _id: result.insertedId.toString() } },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
