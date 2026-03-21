import { toTrimmedString } from "@/lib/domain-write";

export type WorkspacePostAction =
  | "request-review"
  | "cancel-review"
  | "reject-review"
  | "publish"
  | "archive"
  | "restore";

export function normalizeWorkspacePostStatus(value: unknown) {
  return toTrimmedString(value);
}

export function canRequestWorkspacePostReview(status: unknown) {
  return normalizeWorkspacePostStatus(status) === "초안";
}

export function canCancelWorkspacePostReview(status: unknown) {
  return normalizeWorkspacePostStatus(status) === "검토중";
}

export function canPublishWorkspacePost(status: unknown) {
  return normalizeWorkspacePostStatus(status) === "검토중";
}

export function canRejectWorkspacePostReview(status: unknown) {
  return normalizeWorkspacePostStatus(status) === "검토중";
}

export function canArchiveWorkspacePost(status: unknown) {
  const normalizedStatus = normalizeWorkspacePostStatus(status);
  return normalizedStatus === "초안" || normalizedStatus === "검토중" || normalizedStatus === "게시중";
}

export function canRestoreWorkspacePost(status: unknown) {
  return normalizeWorkspacePostStatus(status) === "보관";
}

export function getWorkspacePostStatusTone(status: unknown) {
  switch (normalizeWorkspacePostStatus(status)) {
    case "게시중":
      return "success" as const;
    case "검토중":
      return "warning" as const;
    case "초안":
      return "info" as const;
    case "보관":
    default:
      return "default" as const;
  }
}

export function getWorkspacePostActionLabel(action: WorkspacePostAction) {
  switch (action) {
    case "request-review":
      return "검토 요청";
    case "cancel-review":
      return "검토 취소";
    case "reject-review":
      return "반려";
    case "publish":
      return "게시 승인";
    case "archive":
      return "보관";
    case "restore":
      return "복원";
  }
}
