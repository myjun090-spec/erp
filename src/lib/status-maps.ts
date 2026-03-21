// 도메인별 상태 전이 규칙과 badge 매핑
// workflow.md 기준 공통 상태값 정의

export type StatusTone = "default" | "info" | "success" | "warning" | "danger";

export type StatusDef = {
  label: string;
  tone: StatusTone;
  next?: string[];
};

// ── 공급망/조달 ──

export const vendorQualificationStatus: Record<string, StatusDef> = {
  pending:    { label: "심사대기", tone: "default", next: ["reviewing"] },
  reviewing:  { label: "심사중", tone: "warning", next: ["qualified", "rejected"] },
  qualified:  { label: "적격", tone: "success", next: ["suspended"] },
  rejected:   { label: "부적격", tone: "danger" },
  suspended:  { label: "정지", tone: "danger", next: ["reviewing"] },
};

export const purchaseOrderStatus: Record<string, StatusDef> = {
  draft:              { label: "초안", tone: "default", next: ["submitted"] },
  submitted:          { label: "제출", tone: "info", next: ["approved", "rejected"] },
  approved:           { label: "승인", tone: "success", next: ["partial-received", "completed"] },
  rejected:           { label: "반려", tone: "danger", next: ["draft"] },
  "partial-received": { label: "부분입고", tone: "warning", next: ["completed"] },
  completed:          { label: "완료", tone: "success" },
};

export const inventoryTransactionType: Record<string, StatusDef> = {
  receipt:    { label: "입고", tone: "success" },
  issue:      { label: "출고", tone: "info" },
  transfer:   { label: "이동", tone: "info" },
  return:     { label: "반품", tone: "warning" },
  adjustment: { label: "조정", tone: "default" },
};

export const inventoryTransactionStatus: Record<string, StatusDef> = {
  completed:        { label: "완료", tone: "success" },
  "pending-approval": { label: "승인대기", tone: "warning", next: ["completed", "rejected"] },
  rejected:         { label: "반려", tone: "danger" },
};

// ── 제작/모듈 ──

export const manufacturingOrderStatus: Record<string, StatusDef> = {
  planned:      { label: "계획", tone: "default", next: ["in-progress"] },
  "in-progress": { label: "제작중", tone: "info", next: ["completed", "on-hold"] },
  "on-hold":    { label: "보류", tone: "warning", next: ["in-progress"] },
  completed:    { label: "완료", tone: "success" },
};

export const logisticsStatus: Record<string, StatusDef> = {
  preparing:   { label: "준비중", tone: "default", next: ["in-transit"] },
  "in-transit": { label: "운송중", tone: "info", next: ["arrived"] },
  arrived:     { label: "도착", tone: "success" },
};

export const customsStatus: Record<string, StatusDef> = {
  "n/a":       { label: "N/A", tone: "default" },
  pending:     { label: "통관대기", tone: "warning", next: ["cleared"] },
  cleared:     { label: "통관완료", tone: "success" },
};

export const moduleStatus: Record<string, StatusDef> = {
  planned:      { label: "계획", tone: "default", next: ["fabricating"] },
  fabricating:  { label: "제작중", tone: "info", next: ["testing"] },
  testing:      { label: "검사중", tone: "warning", next: ["shipped", "rework"] },
  rework:       { label: "재작업", tone: "danger", next: ["testing"] },
  shipped:      { label: "출하", tone: "info", next: ["installed"] },
  installed:    { label: "설치완료", tone: "success" },
};

// ── 품질/안전 ──

export const itpApprovalStatus: Record<string, StatusDef> = {
  draft:     { label: "초안", tone: "default", next: ["review"] },
  review:    { label: "검토중", tone: "warning", next: ["approved", "rejected"] },
  approved:  { label: "승인", tone: "success" },
  rejected:  { label: "반려", tone: "danger", next: ["draft"] },
};

export const inspectionResult: Record<string, StatusDef> = {
  pass:        { label: "합격", tone: "success" },
  fail:        { label: "불합격", tone: "danger" },
  conditional: { label: "조건부", tone: "warning" },
};

export const ncrStatus: Record<string, StatusDef> = {
  open:           { label: "Open", tone: "info", next: ["investigating"] },
  investigating:  { label: "조사중", tone: "warning", next: ["disposition"] },
  disposition:    { label: "처분결정", tone: "warning", next: ["closed"] },
  closed:         { label: "Closed", tone: "success" },
};

export const ncrSeverity: Record<string, StatusDef> = {
  critical: { label: "Critical", tone: "danger" },
  major:    { label: "Major", tone: "danger" },
  minor:    { label: "Minor", tone: "info" },
};

export const ncrDisposition: Record<string, StatusDef> = {
  rework:        { label: "재작업", tone: "warning" },
  scrap:         { label: "폐기", tone: "danger" },
  "accept-as-is": { label: "현상수용", tone: "info" },
  return:        { label: "반품", tone: "warning" },
};

export const hseIncidentType: Record<string, StatusDef> = {
  "near-miss":  { label: "아차사고", tone: "warning" },
  minor:        { label: "경상", tone: "info" },
  major:        { label: "중상", tone: "danger" },
  fatality:     { label: "사망", tone: "danger" },
};

// ── 재무 ──

export const journalEntryStatus: Record<string, StatusDef> = {
  draft:    { label: "미확정", tone: "warning", next: ["submitted"] },
  submitted: { label: "제출", tone: "info", next: ["posted", "rejected"] },
  posted:   { label: "확정", tone: "success" },
  rejected: { label: "반려", tone: "danger", next: ["draft"] },
  reversed: { label: "역분개", tone: "default" },
};

export const apStatus: Record<string, StatusDef> = {
  pending:   { label: "Pending", tone: "warning", next: ["approved"] },
  approved:  { label: "Approved", tone: "info", next: ["partial-paid", "paid"] },
  "partial-paid": { label: "부분지급", tone: "warning", next: ["paid"] },
  paid:      { label: "Paid", tone: "success" },
  overdue:   { label: "연체", tone: "danger", next: ["paid"] },
};

export const arStatus: Record<string, StatusDef> = {
  draft:    { label: "Draft", tone: "default", next: ["issued"] },
  issued:   { label: "Issued", tone: "info", next: ["partial-received", "received"] },
  "partial-received": { label: "부분수금", tone: "warning", next: ["received"] },
  received: { label: "수금완료", tone: "success" },
  overdue:  { label: "연체", tone: "danger", next: ["received"] },
};

export const assetStatus: Record<string, StatusDef> = {
  active:     { label: "Active", tone: "success", next: ["disposed"] },
  disposed:   { label: "처분", tone: "default" },
  impaired:   { label: "손상", tone: "danger" },
};

// ── 시운전 ──

export const commPackageStatus: Record<string, StatusDef> = {
  planned:      { label: "계획", tone: "default", next: ["in-progress"] },
  "in-progress": { label: "진행중", tone: "info", next: ["mc-complete"] },
  "mc-complete": { label: "MC 완료", tone: "warning", next: ["comm-complete"] },
  "comm-complete": { label: "시운전 완료", tone: "success", next: ["handed-over"] },
  "handed-over": { label: "인계완료", tone: "success" },
};

export const punchStatus: Record<string, StatusDef> = {
  open:   { label: "Open", tone: "danger", next: ["in-progress"] },
  "in-progress": { label: "조치중", tone: "warning", next: ["closed"] },
  closed: { label: "Closed", tone: "success" },
};

export const punchCategory: Record<string, StatusDef> = {
  A: { label: "Cat.A (MC 전)", tone: "danger" },
  B: { label: "Cat.B (MC 후)", tone: "warning" },
  C: { label: "Cat.C (인계 후)", tone: "info" },
};

export const regulatoryStatus: Record<string, StatusDef> = {
  preparing:  { label: "준비중", tone: "warning", next: ["submitted"] },
  submitted:  { label: "제출", tone: "info", next: ["approved", "revision-required"] },
  "revision-required": { label: "보완요청", tone: "danger", next: ["submitted"] },
  approved:   { label: "승인", tone: "success" },
};

// ── 유틸리티 ──

export function getStatusDef(
  map: Record<string, StatusDef>,
  key: string,
): StatusDef {
  return map[key] ?? { label: key, tone: "default" };
}
