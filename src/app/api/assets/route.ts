import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { stripProtectedCreateFields } from "@/lib/domain-write";
import {
  buildFixedAssetCreateDocument,
  normalizeFixedAssetInput,
  serializeFixedAsset,
  validateFixedAssetInput,
} from "@/lib/fixed-assets";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const docs = await db.collection("fixed_assets").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map((doc) => serializeFixedAsset(doc));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("asset.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const normalizedInput = normalizeFixedAssetInput(body);
    const validationError = validateFixedAssetInput(normalizedInput, projectId);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ ok: false, message: "프로젝트 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    if (
      projectAccessScope.allowedProjectIds &&
      !projectAccessScope.allowedProjectIds.includes(projectId)
    ) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      status: { $ne: "archived" },
    });
    if (!project) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트를 찾을 수 없습니다." }, { status: 400 });
    }
    const duplicateAsset = await db.collection("fixed_assets").findOne({
      assetNo: normalizedInput.assetNo,
    });
    if (duplicateAsset) {
      return NextResponse.json({ ok: false, message: "이미 사용 중인 자산번호입니다." }, { status: 409 });
    }

    const result = await db.collection("fixed_assets").insertOne(
      buildFixedAssetCreateDocument({
        project,
        body,
        profile: auth.profile,
        now,
      }),
    );

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
