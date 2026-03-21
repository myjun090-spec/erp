export type ExecutionBudgetApprovalStatus =
  | "draft"
  | "submitted"
  | "revision-required"
  | "approved";

export type ExecutionBudgetApprovalAction =
  | "submit"
  | "approve"
  | "request-revision"
  | "revoke-approval";

const approvalToneMap: Record<
  ExecutionBudgetApprovalStatus,
  "default" | "info" | "success" | "warning" | "danger"
> = {
  draft: "default",
  submitted: "info",
  "revision-required": "danger",
  approved: "success",
};

const approvalLabelMap: Record<ExecutionBudgetApprovalStatus, string> = {
  draft: "초안",
  submitted: "제출",
  "revision-required": "보완요청",
  approved: "승인",
};

export function normalizeExecutionBudgetApprovalStatus(
  status: unknown,
): ExecutionBudgetApprovalStatus {
  const normalized = String(status || "").trim().toLowerCase();
  switch (normalized) {
    case "submitted":
      return "submitted";
    case "revision-required":
      return "revision-required";
    case "approved":
      return "approved";
    case "draft":
    default:
      return "draft";
  }
}

export function getExecutionBudgetApprovalTone(status: unknown) {
  return approvalToneMap[normalizeExecutionBudgetApprovalStatus(status)];
}

export function getExecutionBudgetApprovalLabel(status: unknown) {
  return approvalLabelMap[normalizeExecutionBudgetApprovalStatus(status)];
}

export function canSubmitExecutionBudget(status: unknown) {
  const normalized = normalizeExecutionBudgetApprovalStatus(status);
  return normalized === "draft" || normalized === "revision-required";
}

export function canApproveExecutionBudget(status: unknown) {
  return normalizeExecutionBudgetApprovalStatus(status) === "submitted";
}

export function canRequestExecutionBudgetRevision(status: unknown) {
  return normalizeExecutionBudgetApprovalStatus(status) === "submitted";
}

export function canRevokeExecutionBudgetApproval(status: unknown) {
  return normalizeExecutionBudgetApprovalStatus(status) === "approved";
}
