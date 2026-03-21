import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildWbsUpdateFields,
  normalizeWbsInput,
  syncExecutionBudgetWbsSnapshot,
  syncSystemWbsSummaries,
  validateWbsInput,
} from "@/lib/project-wbs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; wbsId: string }> },
) {
  const auth = await requireApiActionPermission("wbs.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, wbsId } = await params;
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

    if (!ObjectId.isValid(id) || !ObjectId.isValid(wbsId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 WBS ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingWbs = await db.collection("wbs_items").findOne({
      _id: new ObjectId(wbsId),
      "projectSnapshot.projectId": id,
    });

    if (!existingWbs) {
      return NextResponse.json(
        { ok: false, message: "WBS를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const normalizedWbs = normalizeWbsInput(body);
    const validationMessage = validateWbsInput(normalizedWbs);

    if (validationMessage) {
      return NextResponse.json({ ok: false, message: validationMessage }, { status: 400 });
    }

    if (!ObjectId.isValid(normalizedWbs.unitId)) {
      return NextResponse.json(
        { ok: false, message: "유닛 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const unit = await db.collection("units").findOne({
      _id: new ObjectId(normalizedWbs.unitId),
      "projectSnapshot.projectId": id,
    });

    if (!unit) {
      return NextResponse.json(
        { ok: false, message: "선택한 유닛을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    let system: Record<string, unknown> | null = null;
    if (normalizedWbs.systemId) {
      if (!ObjectId.isValid(normalizedWbs.systemId)) {
        return NextResponse.json(
          { ok: false, message: "시스템 ID 형식이 올바르지 않습니다." },
          { status: 400 },
        );
      }

      system = await db.collection("systems").findOne({
        _id: new ObjectId(normalizedWbs.systemId),
        "projectSnapshot.projectId": id,
        "unitSnapshot.unitId": normalizedWbs.unitId,
      });

      if (!system) {
        return NextResponse.json(
          { ok: false, message: "선택한 시스템을 찾을 수 없습니다." },
          { status: 400 },
        );
      }
    }

    const previousSystemId =
      existingWbs.systemSnapshot && typeof existingWbs.systemSnapshot === "object"
        ? String((existingWbs.systemSnapshot as Record<string, unknown>).systemId ?? "")
        : "";

    const now = new Date().toISOString();
    const result = await db.collection("wbs_items").updateOne(
      { _id: new ObjectId(wbsId) },
      {
        $set: buildWbsUpdateFields(unit, system, auth.profile, body, now),
        $unset: {
          startDate: "",
          endDate: "",
        },
        $inc: { documentVersion: 1 },
      },
    );

    const updatedWbs = await db.collection("wbs_items").findOne({ _id: new ObjectId(wbsId) });
    if (updatedWbs) {
      if (previousSystemId && previousSystemId !== normalizedWbs.systemId) {
        await syncSystemWbsSummaries(db, previousSystemId);
      }
      await syncSystemWbsSummaries(db, normalizedWbs.systemId);
      await syncExecutionBudgetWbsSnapshot(db, wbsId, {
        wbsId,
        code: updatedWbs.code,
        name: updatedWbs.name,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [wbsId],
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
  { params }: { params: Promise<{ id: string; wbsId: string }> },
) {
  const auth = await requireApiActionPermission("wbs.archive");
  if ("error" in auth) return auth.error;

  try {
    const { id, wbsId } = await params;
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

    if (!ObjectId.isValid(id) || !ObjectId.isValid(wbsId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 WBS ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingWbs = await db.collection("wbs_items").findOne({
      _id: new ObjectId(wbsId),
      "projectSnapshot.projectId": id,
    });

    if (!existingWbs) {
      return NextResponse.json(
        { ok: false, message: "WBS를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const linkedBudget = await db.collection("execution_budgets").findOne({
      "projectSnapshot.projectId": id,
      "wbsSnapshot.wbsId": wbsId,
    });
    if (linkedBudget) {
      return NextResponse.json(
        { ok: false, message: "실행예산이 연결된 WBS는 삭제할 수 없습니다." },
        { status: 400 },
      );
    }

    const linkedProgress = await db.collection("progress_records").findOne({
      "projectSnapshot.projectId": id,
      "wbsSnapshot.wbsId": wbsId,
    });
    if (linkedProgress) {
      return NextResponse.json(
        { ok: false, message: "실적 데이터가 연결된 WBS는 삭제할 수 없습니다." },
        { status: 400 },
      );
    }

    const systemId =
      existingWbs.systemSnapshot && typeof existingWbs.systemSnapshot === "object"
        ? String((existingWbs.systemSnapshot as Record<string, unknown>).systemId ?? "")
        : "";

    const result = await db.collection("wbs_items").deleteOne({ _id: new ObjectId(wbsId) });
    if (systemId) {
      await syncSystemWbsSummaries(db, systemId);
    }

    return NextResponse.json({
      ok: true,
      action: "delete",
      affectedCount: result.deletedCount,
      targetIds: [wbsId],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
