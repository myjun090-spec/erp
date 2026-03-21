import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildUnitCreateDocument,
  ensureUniqueUnitNo,
  normalizeUnitInput,
  syncSiteUnitSummaries,
  validateUnitInput,
} from "@/lib/project-units";
import { generateUnitNo } from "@/lib/document-numbers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("unit.create");
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

    const generatedUnitNo = normalizedUnit.unitNo || generateUnitNo();
    const isUniqueUnitNo = await ensureUniqueUnitNo(db, id, generatedUnitNo);
    if (!isUniqueUnitNo) {
      return NextResponse.json(
        { ok: false, message: "같은 프로젝트에 동일한 유닛번호가 이미 존재합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const result = await db.collection("units").insertOne(
      buildUnitCreateDocument(project, site, auth.profile, body, now, generatedUnitNo),
    );

    await syncSiteUnitSummaries(db, normalizedUnit.siteId);

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
