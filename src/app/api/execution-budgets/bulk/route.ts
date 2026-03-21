import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import type { BulkActionRequest } from "@/lib/domain-api";
import {
  canApproveExecutionBudget,
  canRequestExecutionBudgetRevision,
  canRevokeExecutionBudgetApproval,
  canSubmitExecutionBudget,
  normalizeExecutionBudgetApprovalStatus,
  type ExecutionBudgetApprovalAction,
} from "@/lib/execution-budget-approval";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";

const approvalActions = new Set<ExecutionBudgetApprovalAction>([
  "submit",
  "approve",
  "request-revision",
  "revoke-approval",
]);

function getExpectedTransitionError(action: ExecutionBudgetApprovalAction) {
  switch (action) {
    case "submit":
      return "초안 또는 보완요청 상태의 실행예산만 제출할 수 있습니다.";
    case "approve":
      return "제출 상태의 실행예산만 승인할 수 있습니다.";
    case "request-revision":
      return "제출 상태의 실행예산만 보완요청할 수 있습니다.";
    case "revoke-approval":
      return "승인 상태의 실행예산만 승인 취소할 수 있습니다.";
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkActionRequest;
    const action = String(body.action || "") as ExecutionBudgetApprovalAction;
    const targetIds = Array.isArray(body.targetIds) ? body.targetIds : [];

    if (!approvalActions.has(action)) {
      return NextResponse.json(
        { ok: false, message: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    const auth =
      action === "submit"
        ? await requireApiActionPermission("execution-budget.update")
        : await requireApiActionPermission("execution-budget.approve");

    if ("error" in auth) return auth.error;

    const validTargetIds = targetIds.filter((id) => ObjectId.isValid(id));
    if (validTargetIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "대상 실행예산이 없습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const docs = await db
      .collection("execution_budgets")
      .find({
        _id: { $in: validTargetIds.map((id) => new ObjectId(id)) },
      })
      .toArray();

    const accessibleDocs = docs.filter((doc) => {
      if (!projectAccessScope.allowedProjectIds) {
        return true;
      }

      const projectId =
        doc.projectSnapshot && typeof doc.projectSnapshot === "object"
          ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
          : "";

      return projectAccessScope.allowedProjectIds.includes(projectId);
    });

    if (accessibleDocs.length !== validTargetIds.length) {
      return NextResponse.json(
        { ok: false, message: "실행예산을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const transitionAllowed = accessibleDocs.every((doc) => {
      const approvalStatus = normalizeExecutionBudgetApprovalStatus(doc.approvalStatus);
      switch (action) {
        case "submit":
          return canSubmitExecutionBudget(approvalStatus);
        case "approve":
          return canApproveExecutionBudget(approvalStatus);
        case "request-revision":
          return canRequestExecutionBudgetRevision(approvalStatus);
        case "revoke-approval":
          return canRevokeExecutionBudgetApproval(approvalStatus);
      }
    });

    if (!transitionAllowed) {
      return NextResponse.json(
        { ok: false, message: getExpectedTransitionError(action) },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const actorSnapshot = buildActorSnapshot(auth.profile);
    const updateFields =
      action === "submit"
        ? { approvalStatus: "submitted", status: "draft", updatedAt: now, updatedBy: actorSnapshot }
        : action === "approve"
          ? { approvalStatus: "approved", status: "active", updatedAt: now, updatedBy: actorSnapshot }
          : action === "request-revision"
            ? { approvalStatus: "revision-required", status: "draft", updatedAt: now, updatedBy: actorSnapshot }
            : { approvalStatus: "draft", status: "draft", updatedAt: now, updatedBy: actorSnapshot };

    const result = await db.collection("execution_budgets").updateMany(
      { _id: { $in: accessibleDocs.map((doc) => doc._id) } },
      {
        $set: updateFields,
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action,
      affectedCount: result.modifiedCount,
      targetIds: validTargetIds,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
