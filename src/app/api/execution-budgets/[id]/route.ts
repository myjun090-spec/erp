import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { stripProtectedCreateFields } from "@/lib/domain-write";
import {
  buildExecutionBudgetUpdateFields,
  normalizeExecutionBudgetInput,
  serializeExecutionBudgetDocument,
  validateExecutionBudgetInput,
} from "@/lib/execution-budgets";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("project.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("execution_budgets").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";

    if (projectAccessScope.allowedProjectIds && !projectAccessScope.allowedProjectIds.includes(projectId)) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { ...serializeExecutionBudgetDocument(doc), _id: doc._id.toString() },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("execution-budget.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const existing = await db.collection("execution_budgets").findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      existing.projectSnapshot && typeof existing.projectSnapshot === "object"
        ? String((existing.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";

    if (projectAccessScope.allowedProjectIds && !projectAccessScope.allowedProjectIds.includes(projectId)) {
      return NextResponse.json({ ok: false, message: "실행예산을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = stripProtectedCreateFields(await request.json());
    const normalizedInput = normalizeExecutionBudgetInput({
      ...body,
      wbsId:
        existing.wbsSnapshot && typeof existing.wbsSnapshot === "object"
          ? String((existing.wbsSnapshot as Record<string, unknown>).wbsId ?? "")
          : "",
    });
    const validationError = validateExecutionBudgetInput(normalizedInput);

    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("execution_budgets").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: buildExecutionBudgetUpdateFields(existing.version, auth.profile, normalizedInput, now),
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
