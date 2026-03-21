import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import {
  buildSiteCreateDocument,
  normalizeSiteInput,
  syncProjectSiteSummaries,
  validateSiteInput,
} from "@/lib/project-sites";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("site.create");
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
    const normalizedSite = normalizeSiteInput(body);
    const validationMessage = validateSiteInput(normalizedSite);

    if (validationMessage) {
      return NextResponse.json({ ok: false, message: validationMessage }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("sites").insertOne(
      buildSiteCreateDocument(project, auth.profile, body, now),
    );

    await syncProjectSiteSummaries(db, id);

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
