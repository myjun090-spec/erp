import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildSystemSnapshot,
  buildSystemUpdateFields,
  buildUnitSnapshot,
  normalizeSystemInput,
  syncDependentSystemSnapshots,
  syncUnitSystemSummaries,
  validateSystemInput,
} from "@/lib/project-systems";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; systemId: string }> },
) {
  const auth = await requireApiActionPermission("system.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, systemId } = await params;
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

    if (!ObjectId.isValid(id) || !ObjectId.isValid(systemId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 시스템 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingSystem = await db.collection("systems").findOne({
      _id: new ObjectId(systemId),
      "projectSnapshot.projectId": id,
    });

    if (!existingSystem) {
      return NextResponse.json(
        { ok: false, message: "시스템을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const normalizedSystem = normalizeSystemInput(body);
    const validationMessage = validateSystemInput(normalizedSystem, {
      allowLegacyDiscipline:
        existingSystem && typeof existingSystem.discipline === "string"
          ? existingSystem.discipline
          : "",
    });

    if (validationMessage) {
      return NextResponse.json({ ok: false, message: validationMessage }, { status: 400 });
    }

    if (!ObjectId.isValid(normalizedSystem.unitId)) {
      return NextResponse.json(
        { ok: false, message: "유닛 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const unit = await db.collection("units").findOne({
      _id: new ObjectId(normalizedSystem.unitId),
      "projectSnapshot.projectId": id,
    });

    if (!unit) {
      return NextResponse.json(
        { ok: false, message: "선택한 유닛을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const previousUnitId =
      existingSystem.unitSnapshot && typeof existingSystem.unitSnapshot === "object"
        ? String((existingSystem.unitSnapshot as Record<string, unknown>).unitId ?? "")
        : "";

    const now = new Date().toISOString();
    const result = await db.collection("systems").updateOne(
      { _id: new ObjectId(systemId) },
      {
        $set: buildSystemUpdateFields(unit, auth.profile, body, now),
        $inc: { documentVersion: 1 },
      },
    );

    const updatedSystem = await db.collection("systems").findOne({ _id: new ObjectId(systemId) });
    if (updatedSystem) {
      await syncDependentSystemSnapshots(
        db,
        systemId,
        buildUnitSnapshot(unit),
        buildSystemSnapshot(updatedSystem),
      );
    }

    if (previousUnitId && previousUnitId !== normalizedSystem.unitId) {
      await syncUnitSystemSummaries(db, previousUnitId);
    }
    await syncUnitSystemSummaries(db, normalizedSystem.unitId);

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [systemId],
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
  { params }: { params: Promise<{ id: string; systemId: string }> },
) {
  const auth = await requireApiActionPermission("system.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, systemId } = await params;
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

    if (!ObjectId.isValid(id) || !ObjectId.isValid(systemId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 시스템 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingSystem = await db.collection("systems").findOne({
      _id: new ObjectId(systemId),
      "projectSnapshot.projectId": id,
    });

    if (!existingSystem) {
      return NextResponse.json(
        { ok: false, message: "시스템을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const linkedCollections = [
      { collection: "wbs_items", query: { "systemSnapshot.systemId": systemId }, message: "WBS" },
      { collection: "modules", query: { "systemSnapshot.systemId": systemId }, message: "모듈" },
      { collection: "itps", query: { "systemSnapshot.systemId": systemId }, message: "ITP" },
      { collection: "inspections", query: { "systemSnapshot.systemId": systemId }, message: "검사" },
      {
        collection: "commissioning_packages",
        query: { "systemSnapshot.systemId": systemId },
        message: "시운전 패키지",
      },
      {
        collection: "progress_records",
        query: { "systemSnapshot.systemId": systemId },
        message: "실적 데이터",
      },
    ] as const;

    for (const target of linkedCollections) {
      const linked = await db.collection(target.collection).findOne({
        ...target.query,
        "projectSnapshot.projectId": id,
      });
      if (linked) {
        return NextResponse.json(
          { ok: false, message: `${target.message}가 연결된 시스템은 삭제할 수 없습니다.` },
          { status: 400 },
        );
      }
    }

    const unitId =
      existingSystem.unitSnapshot && typeof existingSystem.unitSnapshot === "object"
        ? String((existingSystem.unitSnapshot as Record<string, unknown>).unitId ?? "")
        : "";

    const result = await db.collection("systems").deleteOne({ _id: new ObjectId(systemId) });

    if (unitId) {
      await syncUnitSystemSummaries(db, unitId);
    }

    return NextResponse.json({
      ok: true,
      action: "delete",
      affectedCount: result.deletedCount,
      targetIds: [systemId],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
