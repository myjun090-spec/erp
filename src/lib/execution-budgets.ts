import { buildActorSnapshot, buildCreateMetadata, resolveStatus, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { generateExecutionBudgetCode } from "@/lib/document-numbers";
import { normalizeExecutionBudgetCostCategory } from "@/lib/execution-budget-cost-categories";
import {
  getInitialExecutionBudgetVersion,
  getNextExecutionBudgetVersion,
  normalizeExecutionBudgetVersion,
} from "@/lib/execution-budget-version";
import type { ViewerProfile } from "@/lib/navigation";
import { buildProjectSnapshot } from "@/lib/project-sites";
import { buildWbsSnapshot } from "@/lib/project-wbs";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

export type ExecutionBudgetCostItem = {
  costCategory: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type ExecutionBudgetUsageSummary = {
  committedAmount: number;
  apActualAmount: number;
  journalActualAmount: number;
  actualAmount: number;
  lastCalculatedAt: string;
};

export function buildEmptyExecutionBudgetUsageSummary(): ExecutionBudgetUsageSummary {
  return {
    committedAmount: 0,
    apActualAmount: 0,
    journalActualAmount: 0,
    actualAmount: 0,
    lastCalculatedAt: "",
  };
}

export function buildExecutionBudgetCostItems(totalAmount: number): ExecutionBudgetCostItem[] {
  return [{
    costCategory: "general",
    description: "총 실행예산",
    quantity: 1,
    unitPrice: totalAmount,
    amount: totalAmount,
  }];
}

function normalizeExecutionBudgetCostItem(item: unknown): ExecutionBudgetCostItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const quantity = toNumberValue(record.quantity, 1);
  const unitPrice = toNumberValue(record.unitPrice, toNumberValue(record.amount, 0));
  const amount = toNumberValue(record.amount, quantity * unitPrice);

  return {
    costCategory: normalizeExecutionBudgetCostCategory(
      toTrimmedString(record.costCategory || record.category) || "general",
    ),
    description: toTrimmedString(record.description) || "원가항목",
    quantity: quantity > 0 ? quantity : 0,
    unitPrice: unitPrice >= 0 ? unitPrice : 0,
    amount: amount >= 0 ? amount : 0,
  };
}

export function normalizeExecutionBudgetCostItems(items: unknown): ExecutionBudgetCostItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeExecutionBudgetCostItem(item))
    .filter((item): item is ExecutionBudgetCostItem => item !== null);
}

export function sumExecutionBudgetCostItems(costItems: ExecutionBudgetCostItem[]) {
  return costItems.reduce((sum, item) => sum + toNumberValue(item.amount, 0), 0);
}

export function normalizeExecutionBudgetUsageSummary(value: unknown): ExecutionBudgetUsageSummary {
  return value && typeof value === "object"
    ? {
        committedAmount: toNumberValue((value as Record<string, unknown>).committedAmount),
        apActualAmount: toNumberValue((value as Record<string, unknown>).apActualAmount),
        journalActualAmount: toNumberValue((value as Record<string, unknown>).journalActualAmount),
        actualAmount: toNumberValue((value as Record<string, unknown>).actualAmount),
        lastCalculatedAt: toTrimmedString((value as Record<string, unknown>).lastCalculatedAt),
      }
    : buildEmptyExecutionBudgetUsageSummary();
}

export function calculateExecutionBudgetRemainingAmount(
  totalAmount: number,
  usageSummary: ExecutionBudgetUsageSummary,
) {
  return totalAmount - usageSummary.committedAmount - usageSummary.actualAmount;
}

export function normalizeExecutionBudgetInput(body: Record<string, unknown>) {
  const costItems = normalizeExecutionBudgetCostItems(body.costItems);
  const explicitTotalAmount = toNumberValue(body.totalAmount, toNumberValue(body.totalBudget, 0));
  const allocatedAmount = costItems.length > 0 ? sumExecutionBudgetCostItems(costItems) : 0;

  return {
    wbsId: toTrimmedString(body.wbsId),
    currency: toTrimmedString(body.currency) || "KRW",
    effectiveDate: toTrimmedString(body.effectiveDate),
    costItems,
    totalAmount:
      explicitTotalAmount > 0 || body.totalAmount !== undefined || body.totalBudget !== undefined
        ? explicitTotalAmount
        : allocatedAmount,
    allocatedAmount,
    approvalStatus: toTrimmedString(body.approvalStatus),
    status: toTrimmedString(body.status),
  };
}

export function validateExecutionBudgetInput(input: ReturnType<typeof normalizeExecutionBudgetInput>) {
  if (!input.wbsId) {
    return "WBS를 선택해 주세요.";
  }

  if (!input.effectiveDate) {
    return "적용일을 입력해 주세요.";
  }

  if (!Number.isFinite(input.totalAmount) || input.totalAmount < 0) {
    return "총 예산액은 0 이상이어야 합니다.";
  }

  if (input.totalAmount < input.allocatedAmount) {
    return "원가항목 합계가 총 예산액을 초과할 수 없습니다.";
  }

  return null;
}

export function buildExecutionBudgetCreateDocument(
  project: Record<string, unknown>,
  wbs: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedInput = normalizeExecutionBudgetInput(body);

  return {
    budgetCode: generateExecutionBudgetCode(),
    projectSnapshot: buildProjectSnapshot(project),
    wbsSnapshot: buildWbsSnapshot(wbs),
    version: getInitialExecutionBudgetVersion(),
    currency: normalizedInput.currency,
    costItems:
      normalizedInput.costItems.length > 0
        ? normalizedInput.costItems
        : buildExecutionBudgetCostItems(normalizedInput.totalAmount),
    totalAmount: normalizedInput.totalAmount,
    approvalStatus: resolveStatus(normalizedInput.approvalStatus, "draft"),
    effectiveDate: normalizedInput.effectiveDate,
    status: resolveStatus(normalizedInput.status, "draft"),
    usageSummary: buildEmptyExecutionBudgetUsageSummary(),
    ...buildCreateMetadata(profile, now),
  };
}

export function buildExecutionBudgetUpdateFields(
  currentVersion: unknown,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedInput = normalizeExecutionBudgetInput(body);

  return {
    version: getNextExecutionBudgetVersion(currentVersion),
    currency: normalizedInput.currency,
    costItems:
      normalizedInput.costItems.length > 0
        ? normalizedInput.costItems
        : buildExecutionBudgetCostItems(normalizedInput.totalAmount),
    totalAmount: normalizedInput.totalAmount,
    effectiveDate: normalizedInput.effectiveDate,
    approvalStatus: resolveStatus(normalizedInput.approvalStatus, "draft"),
    status: resolveStatus(normalizedInput.status, "draft"),
    updatedAt: now,
    updatedBy: buildActorSnapshot(profile),
  };
}

export function serializeExecutionBudgetDocument(doc: Record<string, unknown>) {
  const totalAmount = toNumberValue(doc.totalAmount, toNumberValue(doc.totalBudget, 0));
  const costItems = normalizeExecutionBudgetCostItems(doc.costItems);
  const usageSummary = normalizeExecutionBudgetUsageSummary(doc.usageSummary);

  return {
    ...doc,
    version: normalizeExecutionBudgetVersion(doc.version),
    currency: toTrimmedString(doc.currency) || "KRW",
    effectiveDate: toTrimmedString(doc.effectiveDate),
    totalAmount,
    costItems: costItems.length > 0 ? costItems : buildExecutionBudgetCostItems(totalAmount),
    usageSummary,
    remainingAmount: calculateExecutionBudgetRemainingAmount(totalAmount, usageSummary),
  };
}
