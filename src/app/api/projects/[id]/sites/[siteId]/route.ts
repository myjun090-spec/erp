import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import { normalizeSiteInput, syncProjectSiteSummaries, validateSiteInput } from "@/lib/project-sites";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; siteId: string }> },
) {
  const auth = await requireApiActionPermission("site.update");
  if ("error" in auth) return auth.error;

  try {
    const { id, siteId } = await params;
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

    if (!ObjectId.isValid(id) || !ObjectId.isValid(siteId)) {
      return NextResponse.json(
        { ok: false, message: "프로젝트 또는 현장 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existingSite = await db.collection("sites").findOne({
      _id: new ObjectId(siteId),
      "projectSnapshot.projectId": id,
    });

    if (!existingSite) {
      return NextResponse.json(
        { ok: false, message: "현장을 찾을 수 없습니다." },
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
    const result = await db.collection("sites").updateOne(
      { _id: new ObjectId(siteId) },
      {
        $set: {
          name: normalizedSite.name,
          country: normalizedSite.country,
          address: normalizedSite.address,
          status: normalizedSite.status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    await syncProjectSiteSummaries(db, id);

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [siteId],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
