import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildSystemCreateDocument,
  ensureUniqueSystemCode,
  normalizeSystemInput,
  syncUnitSystemSummaries,
  validateSystemInput,
} from "@/lib/project-systems";
import { generateSystemCode } from "@/lib/document-numbers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("project.read");
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

    const db = await getMongoDb();
    const systems = await db
      .collection("systems")
      .find({ "projectSnapshot.projectId": id, status: { $ne: "archived" } })
      .sort({ code: 1 })
      .toArray();

    return NextResponse.json({
      ok: true,
      data: {
        items: systems.map((s) => ({
          _id: s._id.toString(),
          code: s.code as string,
          name: s.name as string,
          discipline: s.discipline as string,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("system.create");
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
    const normalizedSystem = normalizeSystemInput(body);
    const validationMessage = validateSystemInput(normalizedSystem);

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

    const generatedSystemCode = generateSystemCode();
    const isUniqueSystemCode = await ensureUniqueSystemCode(db, id, generatedSystemCode);
    if (!isUniqueSystemCode) {
      return NextResponse.json(
        { ok: false, message: "같은 프로젝트에 동일한 시스템코드가 이미 존재합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const result = await db.collection("systems").insertOne(
      buildSystemCreateDocument(project, unit, auth.profile, body, generatedSystemCode, now),
    );

    await syncUnitSystemSummaries(db, normalizedSystem.unitId);

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
