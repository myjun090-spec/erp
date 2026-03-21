import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildWbsCreateDocument,
  generateNextWbsCode,
  normalizeWbsInput,
  syncExecutionBudgetWbsSnapshot,
  syncSystemWbsSummaries,
  validateWbsInput,
} from "@/lib/project-wbs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("wbs.create");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
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

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const project = await db.collection("projects").findOne({ _id: new ObjectId(id) });

    if (!project) {
      return NextResponse.json(
        { ok: false, message: "프로젝트를 찾을 수 없습니다." },
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

    const now = new Date().toISOString();
    const nextWbsCode = await generateNextWbsCode(db, id);
    const result = await db.collection("wbs_items").insertOne(
      buildWbsCreateDocument(project, unit, system, auth.profile, body, now, nextWbsCode),
    );

    const createdWbs = await db.collection("wbs_items").findOne({ _id: result.insertedId });
    if (createdWbs) {
      await syncSystemWbsSummaries(db, normalizedWbs.systemId);
      await syncExecutionBudgetWbsSnapshot(db, result.insertedId.toString(), {
        wbsId: result.insertedId.toString(),
        code: createdWbs.code,
        name: createdWbs.name,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "create",
      affectedCount: 1,
      targetIds: [result.insertedId.toString()],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
