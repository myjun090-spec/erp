import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireAnyApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, resolveStatus, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["planning", "recruiting", "in-progress", "completed", "cancelled"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("program.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "프로그램을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("programs").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "프로그램을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { ...doc, _id: doc._id.toString() },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyApiActionPermission(["program.update", "program.archive"]);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "프로그램을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("programs").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "프로그램을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const name = toTrimmedString(body.name) || toTrimmedString(doc.name);
    const category = toTrimmedString(body.category) || toTrimmedString(doc.category);
    const targetGroup = toTrimmedString(body.targetGroup) || toTrimmedString(doc.targetGroup);
    const objectives = body.objectives !== undefined ? toTrimmedString(body.objectives) : toTrimmedString(doc.objectives);
    const startDate = body.startDate !== undefined ? toTrimmedString(body.startDate) : toTrimmedString(doc.startDate);
    const endDate = body.endDate !== undefined ? toTrimmedString(body.endDate) : toTrimmedString(doc.endDate);
    const totalSessions = body.totalSessions !== undefined ? toNumberValue(body.totalSessions) : toNumberValue(doc.totalSessions);
    const maxParticipants = body.maxParticipants !== undefined ? toNumberValue(body.maxParticipants) : toNumberValue(doc.maxParticipants);
    const budget = body.budget !== undefined ? toNumberValue(body.budget) : toNumberValue(doc.budget);
    const fundingSource = toTrimmedString(body.fundingSource) || toTrimmedString(doc.fundingSource);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "planning");

    if (!name) {
      return NextResponse.json({ ok: false, message: "프로그램명은 필수입니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "프로그램 상태가 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("programs").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          name,
          category,
          targetGroup,
          objectives,
          startDate,
          endDate,
          totalSessions,
          maxParticipants,
          budget,
          fundingSource,
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
