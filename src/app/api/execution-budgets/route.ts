import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  stripProtectedCreateFields,
} from "@/lib/domain-write";
import {
  buildExecutionBudgetCreateDocument,
  normalizeExecutionBudgetInput,
  serializeExecutionBudgetDocument,
  validateExecutionBudgetInput,
} from "@/lib/execution-budgets";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("project.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const docs = await db.collection("execution_budgets").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map((doc) => ({
      ...serializeExecutionBudgetDocument(doc),
      _id: doc._id.toString(),
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("execution-budget.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const normalizedInput = normalizeExecutionBudgetInput(body);
    const validationError = validateExecutionBudgetInput(normalizedInput);

    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }

    if (!ObjectId.isValid(normalizedInput.wbsId)) {
      return NextResponse.json({ ok: false, message: "WBS 식별자가 올바르지 않습니다." }, { status: 400 });
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const wbs = await db.collection("wbs_items").findOne({
      _id: new ObjectId(normalizedInput.wbsId),
      ...(projectAccessScope.allowedProjectIds
        ? { "projectSnapshot.projectId": { $in: projectAccessScope.allowedProjectIds } }
        : {}),
    });

    if (!wbs) {
      return NextResponse.json({ ok: false, message: "선택한 WBS를 찾을 수 없습니다." }, { status: 404 });
    }

    const projectId =
      wbs.projectSnapshot && typeof wbs.projectSnapshot === "object"
        ? String((wbs.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";

    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({ ok: false, message: "WBS의 프로젝트 정보가 올바르지 않습니다." }, { status: 400 });
    }

    const duplicate = await db.collection("execution_budgets").findOne({
      "projectSnapshot.projectId": projectId,
      "wbsSnapshot.wbsId": normalizedInput.wbsId,
      status: { $ne: "archived" },
    });

    if (duplicate) {
      return NextResponse.json(
        { ok: false, message: "이미 등록된 실행예산이 있습니다. 수정 화면에서 버전을 올려 주세요." },
        { status: 409 },
      );
    }

    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      return NextResponse.json({ ok: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("execution_budgets").insertOne(
      buildExecutionBudgetCreateDocument(project, wbs, auth.profile, body, now),
    );

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
