import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildUnitUpdateFields,
  normalizeUnitInput,
  syncSiteUnitSummaries,
  validateUnitInput,
} from "@/lib/project-units";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> },
) {
  const auth = await requireApiActionPermission("unit.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, unitId } = await params;
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    if (!hasProjectAccess(id, projectAccessScope.allowedProjectIds)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (!ObjectId.isValid(id) || !ObjectId.isValid(unitId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 유닛 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingUnit = await db.collection("units").findOne({
      _id: new ObjectId(unitId),
      "projectSnapshot.projectId": id,
    });

    if (!existingUnit) {
      return NextResponse.json(
        { ok: false, message: "유닛을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const normalizedUnit = normalizeUnitInput(body);
    const validationMessage = validateUnitInput(normalizedUnit);

    if (validationMessage) {
      return NextResponse.json({ ok: false, message: validationMessage }, { status: 400 });
    }

    if (!ObjectId.isValid(normalizedUnit.siteId)) {
      return NextResponse.json(
        { ok: false, message: "현장 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const site = await db.collection("sites").findOne({
      _id: new ObjectId(normalizedUnit.siteId),
      "projectSnapshot.projectId": id,
    });

    if (!site) {
      return NextResponse.json(
        { ok: false, message: "선택한 현장을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const previousSiteId =
      existingUnit.siteSnapshot && typeof existingUnit.siteSnapshot === "object"
        ? String((existingUnit.siteSnapshot as Record<string, unknown>).siteId ?? "")
        : "";

    const now = new Date().toISOString();
    const result = await db.collection("units").updateOne(
      { _id: new ObjectId(unitId) },
      {
        $set: buildUnitUpdateFields(site, auth.profile, body, now),
        $inc: { documentVersion: 1 },
      },
    );

    if (previousSiteId && previousSiteId !== normalizedUnit.siteId) {
      await syncSiteUnitSummaries(db, previousSiteId);
    }
    await syncSiteUnitSummaries(db, normalizedUnit.siteId);

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [unitId],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> },
) {
  const auth = await requireApiActionPermission("unit.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, unitId } = await params;
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    if (!hasProjectAccess(id, projectAccessScope.allowedProjectIds)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (!ObjectId.isValid(id) || !ObjectId.isValid(unitId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 유닛 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingUnit = await db.collection("units").findOne({
      _id: new ObjectId(unitId),
      "projectSnapshot.projectId": id,
    });

    if (!existingUnit) {
      return NextResponse.json(
        { ok: false, message: "유닛을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const linkedSystem = await db.collection("systems").findOne({
      "unitSnapshot.unitId": unitId,
      "projectSnapshot.projectId": id,
    });

    if (linkedSystem) {
      return NextResponse.json(
        { ok: false, message: "하위 시스템이 연결된 유닛은 삭제할 수 없습니다." },
        { status: 400 },
      );
    }

    const siteId =
      existingUnit.siteSnapshot && typeof existingUnit.siteSnapshot === "object"
        ? String((existingUnit.siteSnapshot as Record<string, unknown>).siteId ?? "")
        : "";

    const result = await db.collection("units").deleteOne({ _id: new ObjectId(unitId) });

    if (siteId) {
      await syncSiteUnitSummaries(db, siteId);
    }

    return NextResponse.json({
      ok: true,
      action: "delete",
      affectedCount: result.deletedCount,
      targetIds: [unitId],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
