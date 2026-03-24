function buildTimestamp(date: Date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${y}${mo}${d}-${h}${mi}${s}${ms}`;
}

// ── 이용자/사례 ──
export function generateFacilityCode(d = new Date()) { return `FAC-${buildTimestamp(d)}`; }
export function generateClientNo(d = new Date()) { return `CLT-${buildTimestamp(d)}`; }
export function generateAssessmentNo(d = new Date()) { return `NA-${buildTimestamp(d)}`; }
export function generateCasePlanNo(d = new Date()) { return `CP-${buildTimestamp(d)}`; }
export function generateServiceLinkageNo(d = new Date()) { return `SL-${buildTimestamp(d)}`; }
export function generateCounselingNo(d = new Date()) { return `CR-${buildTimestamp(d)}`; }
export function generateCaseClosureNo(d = new Date()) { return `CC-${buildTimestamp(d)}`; }

// ── 프로그램 ──
export function generateProgramNo(d = new Date()) { return `PGM-${buildTimestamp(d)}`; }
export function generateSessionNo(d = new Date()) { return `PSN-${buildTimestamp(d)}`; }
export function generateSurveyNo(d = new Date()) { return `SVY-${buildTimestamp(d)}`; }
export function generatePerformanceEvalNo(d = new Date()) { return `PEV-${buildTimestamp(d)}`; }

// ── 후원/봉사 ──
export function generateDonorNo(d = new Date()) { return `DNR-${buildTimestamp(d)}`; }
export function generateDonationNo(d = new Date()) { return `DON-${buildTimestamp(d)}`; }
export function generateInKindDonationNo(d = new Date()) { return `IKD-${buildTimestamp(d)}`; }
export function generateVolunteerNo(d = new Date()) { return `VOL-${buildTimestamp(d)}`; }
export function generateVolunteerActivityNo(d = new Date()) { return `VA-${buildTimestamp(d)}`; }
export function generateVolunteerHoursNo(d = new Date()) { return `VH-${buildTimestamp(d)}`; }

// ── 시설/인사 ──
export function generateStaffNo(d = new Date()) { return `STF-${buildTimestamp(d)}`; }
export function generateAttendanceNo(d = new Date()) { return `ATT-${buildTimestamp(d)}`; }
export function generateRoomNo(d = new Date()) { return `RM-${buildTimestamp(d)}`; }
export function generateSupplyNo(d = new Date()) { return `SUP-${buildTimestamp(d)}`; }
export function generateVehicleNo(d = new Date()) { return `VEH-${buildTimestamp(d)}`; }
export function generateVehicleScheduleNo(d = new Date()) { return `VS-${buildTimestamp(d)}`; }

// ── 보조금 ──
export function generateSubsidyNo(d = new Date()) { return `GRT-${buildTimestamp(d)}`; }

// ── 업무지원 ──
export function generateApprovalDocNo(d = new Date()) { return `APD-${buildTimestamp(d)}`; }
export function generateCirculationNo(d = new Date()) { return `CRC-${buildTimestamp(d)}`; }
export function generateDocumentIssueNo(d = new Date()) { return `DOC-${buildTimestamp(d)}`; }
export function generateScheduleNo(d = new Date()) { return `SCH-${buildTimestamp(d)}`; }
export function generateWorkLogNo(d = new Date()) { return `WL-${buildTimestamp(d)}`; }

// ── 재무 ──
export function generateApInvoiceNo(d = new Date()) { return `AP-${buildTimestamp(d)}`; }
export function generateArInvoiceNo(d = new Date()) { return `AR-${buildTimestamp(d)}`; }
export function generateJournalEntryNo(d = new Date()) { return `JE-${buildTimestamp(d)}`; }

// 관리자 모듈
export function generateOrgUnitCode(d = new Date()) { return `OU-${buildTimestamp(d)}`; }
