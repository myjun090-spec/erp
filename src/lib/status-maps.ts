// 도메인별 상태 전이 규칙과 badge 매핑
// 사회복지관 ERP 상태값 정의

export type StatusTone = "default" | "info" | "success" | "warning" | "danger";

export type StatusDef = {
  label: string;
  tone: StatusTone;
  next?: string[];
};

// ── 이용자/사례 ──

export const clientStatus: Record<string, StatusDef> = {
  active: { label: "이용중", tone: "success", next: ["inactive", "transferred"] },
  inactive: { label: "이용중단", tone: "warning", next: ["active"] },
  transferred: { label: "전출", tone: "default", next: [] as string[] },
  deceased: { label: "사망", tone: "danger", next: [] as string[] },
};

export const needsAssessmentStatus: Record<string, StatusDef> = {
  draft: { label: "작성중", tone: "default", next: ["completed"] },
  completed: { label: "완료", tone: "success", next: ["archived"] },
  archived: { label: "보관", tone: "default", next: [] as string[] },
};

export const casePlanStatus: Record<string, StatusDef> = {
  draft: { label: "초안", tone: "default", next: ["submitted"] },
  submitted: { label: "제출", tone: "info", next: ["approved", "rejected"] },
  approved: { label: "승인", tone: "success", next: ["in-progress"] },
  rejected: { label: "반려", tone: "danger", next: ["draft"] },
  "in-progress": { label: "진행중", tone: "info", next: ["completed", "terminated"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  terminated: { label: "중단", tone: "danger", next: [] as string[] },
};

export const serviceLinkageStatus: Record<string, StatusDef> = {
  requested: { label: "의뢰", tone: "info", next: ["connected", "failed"] },
  connected: { label: "연계중", tone: "warning", next: ["completed", "failed"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  failed: { label: "실패", tone: "danger", next: ["requested"] },
};

export const counselingStatus: Record<string, StatusDef> = {
  draft: { label: "작성중", tone: "default", next: ["completed"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
};

export const caseClosureStatus: Record<string, StatusDef> = {
  draft: { label: "초안", tone: "default", next: ["submitted"] },
  submitted: { label: "제출", tone: "info", next: ["approved", "rejected"] },
  approved: { label: "승인", tone: "success", next: [] as string[] },
  rejected: { label: "반려", tone: "danger", next: ["draft"] },
};

// ── 프로그램 ──

export const programStatus: Record<string, StatusDef> = {
  planning: { label: "기획", tone: "default", next: ["recruiting"] },
  recruiting: { label: "모집중", tone: "info", next: ["in-progress", "cancelled"] },
  "in-progress": { label: "운영중", tone: "success", next: ["completed", "cancelled"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  cancelled: { label: "취소", tone: "danger", next: [] as string[] },
};

export const programSessionStatus: Record<string, StatusDef> = {
  scheduled: { label: "예정", tone: "default", next: ["completed", "cancelled"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  cancelled: { label: "취소", tone: "danger", next: [] as string[] },
};

export const participantStatus: Record<string, StatusDef> = {
  enrolled: { label: "등록", tone: "success", next: ["withdrawn", "completed"] },
  withdrawn: { label: "중도포기", tone: "warning", next: [] as string[] },
  completed: { label: "수료", tone: "success", next: [] as string[] },
};

// ── 후원/봉사 ──

export const donorStatus: Record<string, StatusDef> = {
  active: { label: "활동", tone: "success", next: ["inactive", "archived"] },
  inactive: { label: "중단", tone: "warning", next: ["active"] },
  archived: { label: "보관", tone: "default", next: [] as string[] },
};

export const donationStatus: Record<string, StatusDef> = {
  received: { label: "입금", tone: "success", next: ["receipted", "refunded"] },
  receipted: { label: "영수증발급", tone: "info", next: [] as string[] },
  refunded: { label: "환불", tone: "danger", next: [] as string[] },
};

export const inKindDonationStatus: Record<string, StatusDef> = {
  received: { label: "접수", tone: "info", next: ["stored", "distributed"] },
  stored: { label: "보관중", tone: "warning", next: ["distributed", "disposed"] },
  distributed: { label: "배분완료", tone: "success", next: [] as string[] },
  disposed: { label: "폐기", tone: "danger", next: [] as string[] },
};

export const volunteerStatus: Record<string, StatusDef> = {
  active: { label: "활동", tone: "success", next: ["inactive", "archived"] },
  inactive: { label: "중단", tone: "warning", next: ["active"] },
  archived: { label: "보관", tone: "default", next: [] as string[] },
};

export const volunteerActivityStatus: Record<string, StatusDef> = {
  scheduled: { label: "예정", tone: "default", next: ["in-progress", "cancelled"] },
  "in-progress": { label: "진행중", tone: "info", next: ["completed"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  cancelled: { label: "취소", tone: "danger", next: [] as string[] },
};

export const volunteerHoursStatus: Record<string, StatusDef> = {
  pending: { label: "대기", tone: "warning", next: ["approved", "rejected"] },
  approved: { label: "승인", tone: "success", next: [] as string[] },
  rejected: { label: "반려", tone: "danger", next: ["pending"] },
};

// ── 시설/인사 ──

export const staffStatus: Record<string, StatusDef> = {
  active: { label: "재직", tone: "success", next: ["on-leave", "resigned"] },
  "on-leave": { label: "휴직", tone: "warning", next: ["active", "resigned"] },
  resigned: { label: "퇴직", tone: "default", next: [] as string[] },
};

export const hrAttendanceStatus: Record<string, StatusDef> = {
  recorded: { label: "기록", tone: "default", next: ["approved", "rejected"] },
  approved: { label: "승인", tone: "success", next: [] as string[] },
  rejected: { label: "반려", tone: "danger", next: ["recorded"] },
};

export const facilityRoomStatus: Record<string, StatusDef> = {
  available: { label: "사용가능", tone: "success", next: ["occupied", "maintenance", "closed"] },
  occupied: { label: "사용중", tone: "info", next: ["available"] },
  maintenance: { label: "정비중", tone: "warning", next: ["available"] },
  closed: { label: "폐쇄", tone: "danger", next: [] as string[] },
};

export const supplyStatus: Record<string, StatusDef> = {
  "in-stock": { label: "재고있음", tone: "success", next: ["low-stock", "out-of-stock"] },
  "low-stock": { label: "재고부족", tone: "warning", next: ["in-stock", "out-of-stock"] },
  "out-of-stock": { label: "재고없음", tone: "danger", next: ["in-stock"] },
};

export const vehicleStatus: Record<string, StatusDef> = {
  available: { label: "대기", tone: "success", next: ["in-use", "maintenance", "disposed"] },
  "in-use": { label: "운행중", tone: "info", next: ["available"] },
  maintenance: { label: "정비중", tone: "warning", next: ["available"] },
  disposed: { label: "폐차", tone: "danger", next: [] as string[] },
};

export const vehicleScheduleStatus: Record<string, StatusDef> = {
  scheduled: { label: "예정", tone: "default", next: ["in-progress", "cancelled"] },
  "in-progress": { label: "운행중", tone: "info", next: ["completed"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  cancelled: { label: "취소", tone: "danger", next: [] as string[] },
};

// ── 보조금 ──

export const subsidyStatus: Record<string, StatusDef> = {
  draft: { label: "초안", tone: "default", next: ["approved"] },
  approved: { label: "교부결정", tone: "info", next: ["active"] },
  active: { label: "집행중", tone: "success", next: ["settled"] },
  settled: { label: "정산완료", tone: "success", next: ["returned"] },
  returned: { label: "반환", tone: "warning", next: [] as string[] },
};

// ── 업무지원 ──

export const approvalDocumentStatus: Record<string, StatusDef> = {
  draft: { label: "초안", tone: "default", next: ["submitted"] },
  submitted: { label: "상신", tone: "info", next: ["approved", "rejected"] },
  approved: { label: "승인", tone: "success", next: [] as string[] },
  rejected: { label: "반려", tone: "danger", next: ["draft"] },
};

export const circulationStatus: Record<string, StatusDef> = {
  active: { label: "공람중", tone: "info", next: ["completed", "archived"] },
  completed: { label: "확인완료", tone: "success", next: ["archived"] },
  archived: { label: "보관", tone: "default", next: [] as string[] },
};

export const scheduleStatus: Record<string, StatusDef> = {
  scheduled: { label: "예정", tone: "default", next: ["completed", "cancelled"] },
  completed: { label: "완료", tone: "success", next: [] as string[] },
  cancelled: { label: "취소", tone: "danger", next: [] as string[] },
};

export const workLogStatus: Record<string, StatusDef> = {
  draft: { label: "작성중", tone: "default", next: ["submitted"] },
  submitted: { label: "제출", tone: "info", next: ["approved"] },
  approved: { label: "승인", tone: "success", next: [] as string[] },
};

// ── 시설 ──

export const facilityStatus: Record<string, StatusDef> = {
  active: { label: "운영중", tone: "success", next: ["suspended", "closed"] },
  suspended: { label: "일시중단", tone: "warning", next: ["active", "closed"] },
  closed: { label: "폐쇄", tone: "danger", next: [] as string[] },
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

// ── 유틸리티 ──

export function getStatusDef(
  map: Record<string, StatusDef>,
  key: string,
): StatusDef {
  return map[key] ?? { label: key, tone: "default" };
}
