import { ObjectId, type Db } from "mongodb";
import { toTrimmedString } from "@/lib/domain-write";
import { normalizeExecutionBudgetVersion } from "@/lib/execution-budget-version";
import { normalizeProjectIds } from "@/lib/project-scope";
import { buildProjectSnapshot } from "@/lib/project-sites";
import { buildWbsSnapshot } from "@/lib/project-wbs";

export function buildBudgetSnapshot(budget: Record<string, unknown>) {
  return {
    budgetId: String(budget._id),
    budgetCode: toTrimmedString(budget.budgetCode),
    version: normalizeExecutionBudgetVersion(budget.version),
    effectiveDate: toTrimmedString(budget.effectiveDate),
    totalAmount:
      typeof budget.totalAmount === "number" ? budget.totalAmount : Number(budget.totalAmount || 0),
  };
}

export function normalizeBudgetLinkInput(body: Record<string, unknown>) {
  return {
    projectId: toTrimmedString(body.projectId),
    wbsId: toTrimmedString(body.wbsId),
    budgetId: toTrimmedString(body.budgetId),
  };
}

export function validateBudgetLinkInput(input: ReturnType<typeof normalizeBudgetLinkInput>) {
  if (!input.projectId) {
    return "프로젝트를 선택해 주세요.";
  }

  if (!input.wbsId) {
    return "WBS를 선택해 주세요.";
  }

  if (!input.budgetId) {
    return "연결된 실행예산이 필요합니다.";
  }

  return null;
}

export async function resolveBudgetLinkDocuments(
  db: Db,
  input: ReturnType<typeof normalizeBudgetLinkInput>,
  allowedProjectIds?: string[] | null,
) {
  if (
    !ObjectId.isValid(input.projectId) ||
    !ObjectId.isValid(input.wbsId) ||
    !ObjectId.isValid(input.budgetId)
  ) {
    return { error: "프로젝트/WBS/실행예산 식별자가 올바르지 않습니다." } as const;
  }

  const normalizedAllowedProjectIds = normalizeProjectIds(allowedProjectIds);
  if (
    normalizedAllowedProjectIds &&
    !normalizedAllowedProjectIds.includes(input.projectId)
  ) {
    return { error: "선택한 프로젝트에 접근할 수 없습니다." } as const;
  }

  const project = await db.collection("projects").findOne({
    _id: new ObjectId(input.projectId),
  });

  if (!project) {
    return { error: "프로젝트를 찾을 수 없습니다." } as const;
  }

  const wbs = await db.collection("wbs_items").findOne({
    _id: new ObjectId(input.wbsId),
    "projectSnapshot.projectId": input.projectId,
    status: { $ne: "archived" },
  });

  if (!wbs) {
    return { error: "선택한 WBS를 찾을 수 없습니다." } as const;
  }

  const budget = await db.collection("execution_budgets").findOne({
    _id: new ObjectId(input.budgetId),
    "projectSnapshot.projectId": input.projectId,
    "wbsSnapshot.wbsId": input.wbsId,
    status: { $ne: "archived" },
  });

  if (!budget) {
    return { error: "선택한 실행예산을 찾을 수 없습니다." } as const;
  }

  return { project, wbs, budget } as const;
}

export function buildBudgetLinkSnapshots(
  project: Record<string, unknown>,
  wbs: Record<string, unknown>,
  budget: Record<string, unknown>,
) {
  return {
    projectSnapshot: buildProjectSnapshot(project),
    wbsSnapshot: buildWbsSnapshot(wbs),
    budgetSnapshot: buildBudgetSnapshot(budget),
  };
}
