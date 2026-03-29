/**
 * Seed script for AI Operations demo data.
 *
 * Usage:
 *   npx tsx scripts/seed-operations.ts
 *
 * Requires MONGODB_URI (or MONGODB_URL) environment variable.
 */

import { MongoClient } from "mongodb";

const uri =
  process.env.MONGODB_URI?.trim() ||
  process.env.MONGODB_URL?.trim() ||
  "";

if (!uri) {
  console.error("MONGODB_URI or MONGODB_URL is not set.");
  process.exit(1);
}

const dbName = process.env.MONGODB_DB_NAME?.trim() || (() => {
  try {
    const url = new URL(uri);
    return url.pathname.replace(/^\//, "") || "erp";
  } catch {
    return "erp";
  }
})();

const now = new Date();
function daysAgo(n: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function hoursAgo(n: number) {
  const d = new Date(now);
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

const actorSnapshot = {
  userId: "sysadmin@welfare.local",
  employeeNo: "",
  displayName: "시스템 관리자",
  orgUnitName: "정보기술팀",
};

function buildMeta(createdAt: string) {
  return {
    tenantId: "smr-default",
    schemaVersion: 1,
    documentVersion: 1,
    createdAt,
    createdBy: actorSnapshot,
    updatedAt: createdAt,
    updatedBy: actorSnapshot,
  };
}

// ──────────── Staff ────────────

const staffData = [
  {
    name: "김안전",
    email: "safety.kim@welfare.local",
    role: "안전관리사",
    department: "시설관리팀",
    phone: "010-1111-0001",
    skills: ["안전관리", "시설관리"],
    schedule: [
      { dayOfWeek: 0, shift: "휴무" },
      { dayOfWeek: 1, shift: "오전" },
      { dayOfWeek: 2, shift: "오전" },
      { dayOfWeek: 3, shift: "오후" },
      { dayOfWeek: 4, shift: "오전" },
      { dayOfWeek: 5, shift: "오후" },
      { dayOfWeek: 6, shift: "휴무" },
    ],
    isActive: true,
    currentLoad: 1,
  },
  {
    name: "이복지",
    email: "welfare.lee@welfare.local",
    role: "사회복지사",
    department: "서비스팀",
    phone: "010-1111-0002",
    skills: ["사회복지", "상담", "프로그램운영"],
    schedule: [
      { dayOfWeek: 0, shift: "휴무" },
      { dayOfWeek: 1, shift: "오전" },
      { dayOfWeek: 2, shift: "오후" },
      { dayOfWeek: 3, shift: "오전" },
      { dayOfWeek: 4, shift: "오후" },
      { dayOfWeek: 5, shift: "오전" },
      { dayOfWeek: 6, shift: "휴무" },
    ],
    isActive: true,
    currentLoad: 2,
  },
  {
    name: "박시설",
    email: "facility.park@welfare.local",
    role: "시설관리원",
    department: "시설관리팀",
    phone: "010-1111-0003",
    skills: ["시설관리", "IT/정보"],
    schedule: [
      { dayOfWeek: 0, shift: "휴무" },
      { dayOfWeek: 1, shift: "오후" },
      { dayOfWeek: 2, shift: "오전" },
      { dayOfWeek: 3, shift: "오후" },
      { dayOfWeek: 4, shift: "오전" },
      { dayOfWeek: 5, shift: "오후" },
      { dayOfWeek: 6, shift: "오전" },
    ],
    isActive: true,
    currentLoad: 0,
  },
  {
    name: "최간호",
    email: "nurse.choi@welfare.local",
    role: "간호사",
    department: "건강관리팀",
    phone: "010-1111-0004",
    skills: ["의료/간호", "안전관리"],
    schedule: [
      { dayOfWeek: 0, shift: "오전" },
      { dayOfWeek: 1, shift: "오전" },
      { dayOfWeek: 2, shift: "오전" },
      { dayOfWeek: 3, shift: "휴무" },
      { dayOfWeek: 4, shift: "오전" },
      { dayOfWeek: 5, shift: "오전" },
      { dayOfWeek: 6, shift: "휴무" },
    ],
    isActive: true,
    currentLoad: 1,
  },
  {
    name: "정행정",
    email: "admin.jung@welfare.local",
    role: "행정담당",
    department: "행정팀",
    phone: "010-1111-0005",
    skills: ["행정", "사회복지"],
    schedule: [
      { dayOfWeek: 0, shift: "휴무" },
      { dayOfWeek: 1, shift: "오전" },
      { dayOfWeek: 2, shift: "오전" },
      { dayOfWeek: 3, shift: "오전" },
      { dayOfWeek: 4, shift: "오전" },
      { dayOfWeek: 5, shift: "오전" },
      { dayOfWeek: 6, shift: "휴무" },
    ],
    isActive: true,
    currentLoad: 0,
  },
  {
    name: "한운전",
    email: "driver.han@welfare.local",
    role: "차량운전원",
    department: "시설관리팀",
    phone: "010-1111-0006",
    skills: ["차량운전", "시설관리"],
    schedule: [
      { dayOfWeek: 0, shift: "휴무" },
      { dayOfWeek: 1, shift: "오전" },
      { dayOfWeek: 2, shift: "오전" },
      { dayOfWeek: 3, shift: "오후" },
      { dayOfWeek: 4, shift: "오전" },
      { dayOfWeek: 5, shift: "오전" },
      { dayOfWeek: 6, shift: "휴무" },
    ],
    isActive: true,
    currentLoad: 0,
  },
];

// ──────────── Issues ────────────

const issuesData = [
  {
    title: "1층 화장실 누수 발생",
    description: "1층 남자 화장실 세면대 아래 배관에서 누수가 발생하고 있습니다. 바닥에 물이 고여 미끄럼 위험이 있어 현재 경고 표지판을 설치해 두었습니다.",
    reporterName: "김안전",
    reporterEmail: "safety.kim@welfare.local",
    location: "1층 남자 화장실",
    imageUrls: [],
    status: "접수",
    aiAnalysis: {
      category: "시설고장",
      urgency: "보통",
      riskLevel: 3,
      recommendedAction: "시설 상태를 점검하고, 수리 일정을 조율하십시오. 필요시 이용자에게 안내합니다.",
      summary: "[자동분석] 시설고장 관련 이슈로 분류되었습니다. 긴급도: 보통, 위험도: 3/5",
      analyzedAt: daysAgo(2),
    },
    assignedStaffId: null,
    assignedStaffName: null,
    assignmentReason: null,
    resolution: null,
    resolvedAt: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    title: "프로그램실 에어컨 작동 불량",
    description: "2층 프로그램실 A의 에어컨이 작동하지 않습니다. 여름철 이용자 건강을 위해 조속한 수리가 필요합니다. 제조사 서비스센터 연락처 확인 필요.",
    reporterName: "이복지",
    reporterEmail: "welfare.lee@welfare.local",
    location: "2층 프로그램실 A",
    imageUrls: [],
    status: "배정됨",
    aiAnalysis: {
      category: "시설고장",
      urgency: "보통",
      riskLevel: 2,
      recommendedAction: "시설 상태를 점검하고, 수리 일정을 조율하십시오. 필요시 이용자에게 안내합니다.",
      summary: "[자동분석] 시설고장 관련 이슈로 분류되었습니다. 긴급도: 보통, 위험도: 2/5",
      analyzedAt: daysAgo(3),
    },
    assignedStaffId: null, // Will link to 박시설 after insert
    assignedStaffName: "박시설",
    assignmentReason: "시설관리 역량 보유, 현재 배정 이슈 없음",
    resolution: null,
    resolvedAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },
  {
    title: "이용자 A 낙상 사고",
    description: "오전 10시경 3층 복도에서 이용자 A(78세)가 미끄러져 넘어졌습니다. 우측 팔에 타박상이 있으며, 간호사가 응급처치 완료했습니다. 보호자에게 연락 필요.",
    reporterName: "최간호",
    reporterEmail: "nurse.choi@welfare.local",
    location: "3층 복도",
    imageUrls: [],
    status: "처리중",
    aiAnalysis: {
      category: "안전사고",
      urgency: "긴급",
      riskLevel: 4,
      recommendedAction: "즉시 현장 확인 및 응급 조치를 실시하고, 관련 기관에 신고하십시오. 이용자 안전을 최우선으로 확보합니다.",
      summary: "[자동분석] 안전사고 관련 이슈로 분류되었습니다. 긴급도: 긴급, 위험도: 4/5",
      analyzedAt: daysAgo(1),
    },
    assignedStaffId: null,
    assignedStaffName: "최간호",
    assignmentReason: "의료/간호 역량 보유, 현재 근무 중",
    resolution: null,
    resolvedAt: null,
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(6),
  },
  {
    title: "급식 서비스 불만 접수",
    description: "이용자 3명이 오늘 점심 급식의 맛과 양에 대해 불만을 제기했습니다. 특히 국물 요리가 너무 짜다는 의견이 있었습니다.",
    reporterName: "이복지",
    reporterEmail: "welfare.lee@welfare.local",
    location: "1층 식당",
    imageUrls: [],
    status: "완료",
    aiAnalysis: {
      category: "이용자컴플레인",
      urgency: "낮음",
      riskLevel: 2,
      recommendedAction: "이용자의 의견을 경청하고, 담당 부서와 협의하여 개선 방안을 마련하십시오. 결과를 이용자에게 회신합니다.",
      summary: "[자동분석] 이용자컴플레인 관련 이슈로 분류되었습니다. 긴급도: 낮음, 위험도: 2/5",
      analyzedAt: daysAgo(5),
    },
    assignedStaffId: null,
    assignedStaffName: "이복지",
    assignmentReason: "사회복지, 상담 역량 보유",
    resolution: "급식업체와 협의하여 메뉴 및 양념 조정 완료. 이용자에게 개선 사항 안내.",
    resolvedAt: daysAgo(4),
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
  {
    title: "엘리베이터 이상 소음",
    description: "건물 엘리베이터에서 운행 시 비정상적인 소음이 발생합니다. 안전 점검이 필요하며, 이용자 이용 제한을 검토해야 합니다.",
    reporterName: "김안전",
    reporterEmail: "safety.kim@welfare.local",
    location: "건물 엘리베이터",
    imageUrls: [],
    status: "완료",
    aiAnalysis: {
      category: "시설고장",
      urgency: "긴급",
      riskLevel: 4,
      recommendedAction: "시설 사용을 즉시 중단하고, 수리 업체에 긴급 출동을 요청하십시오. 대체 공간을 확보합니다.",
      summary: "[자동분석] 시설고장 관련 이슈로 분류되었습니다. 긴급도: 긴급, 위험도: 4/5",
      analyzedAt: daysAgo(6),
    },
    assignedStaffId: null,
    assignedStaffName: "박시설",
    assignmentReason: "시설관리 역량 보유",
    resolution: "엘리베이터 유지보수 업체 점검 완료. 베어링 교체 및 윤활유 보충. 안전 인증 갱신.",
    resolvedAt: daysAgo(4),
    createdAt: daysAgo(6),
    updatedAt: daysAgo(4),
  },
  {
    title: "주차장 CCTV 화면 끊김",
    description: "주차장 CCTV 3번 카메라 화면이 간헐적으로 끊기고 있습니다. 보안 사각지대가 발생할 수 있어 점검 요청합니다.",
    reporterName: "정행정",
    reporterEmail: "admin.jung@welfare.local",
    location: "지하 주차장",
    imageUrls: [],
    status: "접수",
    aiAnalysis: {
      category: "시설고장",
      urgency: "보통",
      riskLevel: 3,
      recommendedAction: "시설 상태를 점검하고, 수리 일정을 조율하십시오. 필요시 이용자에게 안내합니다.",
      summary: "[자동분석] 시설고장 관련 이슈로 분류되었습니다. 긴급도: 보통, 위험도: 3/5",
      analyzedAt: hoursAgo(4),
    },
    assignedStaffId: null,
    assignedStaffName: null,
    assignmentReason: null,
    resolution: null,
    resolvedAt: null,
    createdAt: hoursAgo(4),
    updatedAt: hoursAgo(4),
  },
  {
    title: "봉사활동 일정 변경 요청",
    description: "외부 봉사단체에서 이번 주 토요일 봉사활동 일정을 다음 주로 변경 요청했습니다. 참여자 및 프로그램 일정 조정 필요.",
    reporterName: "정행정",
    reporterEmail: "admin.jung@welfare.local",
    location: "관리실",
    imageUrls: [],
    status: "접수",
    aiAnalysis: {
      category: "기타",
      urgency: "낮음",
      riskLevel: 1,
      recommendedAction: "상황을 확인하고 적절한 담당자에게 전달하십시오.",
      summary: "[자동분석] 기타 관련 이슈로 분류되었습니다. 긴급도: 낮음, 위험도: 1/5",
      analyzedAt: hoursAgo(2),
    },
    assignedStaffId: null,
    assignedStaffName: null,
    assignmentReason: null,
    resolution: null,
    resolvedAt: null,
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
  },
  {
    title: "이용자 B 가족 상담 요청",
    description: "이용자 B의 보호자가 서비스 이용 관련 상담을 요청했습니다. 현재 서비스 만족도와 향후 프로그램 참여에 대한 논의가 필요합니다.",
    reporterName: "이복지",
    reporterEmail: "welfare.lee@welfare.local",
    location: "상담실",
    imageUrls: [],
    status: "처리중",
    aiAnalysis: {
      category: "이용자컴플레인",
      urgency: "보통",
      riskLevel: 2,
      recommendedAction: "이용자의 의견을 경청하고, 담당 부서와 협의하여 개선 방안을 마련하십시오. 결과를 이용자에게 회신합니다.",
      summary: "[자동분석] 이용자컴플레인 관련 이슈로 분류되었습니다. 긴급도: 보통, 위험도: 2/5",
      analyzedAt: daysAgo(1),
    },
    assignedStaffId: null,
    assignedStaffName: "이복지",
    assignmentReason: "사회복지, 상담 역량 보유, 현재 근무 중",
    resolution: null,
    resolvedAt: null,
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(3),
  },
];

// ──────────── Handovers ────────────

const handoverData = [
  {
    shiftDate: daysAgo(1).slice(0, 10),
    shiftType: "오전",
    authorName: "김안전",
    authorEmail: "safety.kim@welfare.local",
    aiSummary: `${daysAgo(1).slice(0, 10)} 오전 근무 인수인계 요약: 총 3건의 이슈가 확인되었으며, 1건(이용자 A 낙상)은 긴급 처리 중입니다. 1층 화장실 누수 건은 수리 업체 연락 대기 중이며, 에어컨 건은 박시설 담당자가 처리 예정입니다.`,
    issuesSummary: [
      { issueId: "", title: "이용자 A 낙상 사고", status: "처리중", summary: "3층 복도 낙상, 응급처치 완료, 보호자 연락 필요" },
      { issueId: "", title: "1층 화장실 누수 발생", status: "접수", summary: "배관 누수, 경고 표지판 설치" },
      { issueId: "", title: "프로그램실 에어컨 작동 불량", status: "배정됨", summary: "박시설 담당 배정, 서비스센터 연락 예정" },
    ],
    pendingItems: [
      "[긴급] 이용자 A 낙상 사고 - 처리중",
      "[보통] 1층 화장실 누수 발생 - 접수",
      "[보통] 프로그램실 에어컨 작동 불량 - 배정됨",
    ],
    manualNotes: "이용자 A 보호자에게 전화 완료. 내일 방문 예정. 낙상 보고서 작성 필요.\n화장실 누수 부분 임시 테이프 처리 완료.",
    vocNotes: "이용자 C가 프로그램실 온도가 너무 높다고 불만. 에어컨 수리 후 조치 필요.",
    specialInstructions: "이용자 A는 오늘 하루 활동 참여 제한. 안정 위주로 관찰.",
    reminders: ["화장실 누수 부분 2시간마다 확인", "이용자 A 상태 수시 확인"],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    shiftDate: daysAgo(2).slice(0, 10),
    shiftType: "오후",
    authorName: "이복지",
    authorEmail: "welfare.lee@welfare.local",
    aiSummary: `${daysAgo(2).slice(0, 10)} 오후 근무 인수인계 요약: 급식 불만 건 처리 완료. 엘리베이터 점검 예약 확인. 특이사항 없음.`,
    issuesSummary: [
      { issueId: "", title: "급식 서비스 불만 접수", status: "완료", summary: "급식업체 협의 완료, 메뉴 조정" },
      { issueId: "", title: "엘리베이터 이상 소음", status: "처리중", summary: "유지보수 업체 점검 예약" },
    ],
    pendingItems: [
      "[긴급] 엘리베이터 이상 소음 - 처리중",
    ],
    manualNotes: "급식 업체와 전화 통화 완료. 다음 주부터 메뉴 조정 반영 예정.",
    vocNotes: "",
    specialInstructions: "",
    reminders: ["엘리베이터 점검 업체 내일 오전 방문 예정"],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
];

// ──────────── Board Entries ────────────

const boardData = [
  {
    type: "issue",
    title: "새 이슈: 1층 화장실 누수 발생",
    content: "시설고장 / 보통 / 위험도 3 - [자동분석] 시설고장 관련 이슈로 분류되었습니다.",
    authorName: "김안전",
    category: "시설고장",
    urgency: "보통",
    riskLevel: 3,
    createdAt: daysAgo(2),
  },
  {
    type: "issue",
    title: "새 이슈: 이용자 A 낙상 사고",
    content: "안전사고 / 긴급 / 위험도 4 - [자동분석] 안전사고 관련 이슈로 분류되었습니다.",
    authorName: "최간호",
    category: "안전사고",
    urgency: "긴급",
    riskLevel: 4,
    createdAt: daysAgo(1),
  },
  {
    type: "notification",
    title: "이슈 배정: 박시설",
    content: "프로그램실 에어컨 작동 불량 이슈가 박시설에게 배정되었습니다.",
    authorName: "시스템 관리자",
    createdAt: daysAgo(2),
  },
  {
    type: "notification",
    title: "이슈 배정: 최간호",
    content: "이용자 A 낙상 사고 이슈가 최간호에게 배정되었습니다.",
    authorName: "시스템 관리자",
    createdAt: daysAgo(1),
  },
  {
    type: "handover",
    title: "인수인계: " + daysAgo(1).slice(0, 10) + " 오전",
    content: "3건의 이슈 중 1건 긴급 처리 중. 이용자 A 낙상 관련 보호자 연락 완료.",
    authorName: "김안전",
    createdAt: daysAgo(1),
  },
  {
    type: "handover",
    title: "인수인계: " + daysAgo(2).slice(0, 10) + " 오후",
    content: "급식 불만 건 처리 완료. 엘리베이터 점검 예약 확인.",
    authorName: "이복지",
    createdAt: daysAgo(2),
  },
  {
    type: "announcement",
    title: "4월 정기 안전점검 안내",
    content: "4월 첫째 주 월요일에 건물 전체 안전점검이 예정되어 있습니다. 각 부서별 점검 체크리스트를 사전에 준비해 주시기 바랍니다.",
    authorName: "시스템 관리자",
    createdAt: daysAgo(3),
  },
  {
    type: "issue",
    title: "새 이슈: 주차장 CCTV 화면 끊김",
    content: "시설고장 / 보통 / 위험도 3 - 주차장 CCTV 3번 카메라 화면 간헐적 끊김.",
    authorName: "정행정",
    category: "시설고장",
    urgency: "보통",
    riskLevel: 3,
    createdAt: hoursAgo(4),
  },
  {
    type: "issue",
    title: "새 이슈: 봉사활동 일정 변경 요청",
    content: "기타 / 낮음 / 위험도 1 - 외부 봉사단체 일정 변경 요청.",
    authorName: "정행정",
    category: "기타",
    urgency: "낮음",
    riskLevel: 1,
    createdAt: hoursAgo(2),
  },
];

// ──────────── Main ────────────

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    // Drop existing collections for clean seed
    const collections = ["ops_staff", "ops_issues", "ops_handovers", "ops_board_entries"];
    for (const col of collections) {
      try {
        await db.collection(col).drop();
      } catch {
        // collection may not exist
      }
    }

    // Insert staff
    const staffResult = await db.collection("ops_staff").insertMany(
      staffData.map((s) => ({ ...s, ...buildMeta(daysAgo(10)) })),
    );
    const staffIds = Object.values(staffResult.insertedIds).map((id) => id.toString());
    console.log(`Inserted ${staffIds.length} staff members.`);

    // Insert issues
    const issueResult = await db.collection("ops_issues").insertMany(
      issuesData.map((issue) => ({ ...issue, ...buildMeta(issue.createdAt) })),
    );
    const issueIds = Object.values(issueResult.insertedIds).map((id) => id.toString());
    console.log(`Inserted ${issueIds.length} issues.`);

    // Insert handovers
    const handoverResult = await db.collection("ops_handovers").insertMany(
      handoverData.map((h) => ({ ...h, ...buildMeta(h.createdAt) })),
    );
    console.log(`Inserted ${Object.keys(handoverResult.insertedIds).length} handovers.`);

    // Insert board entries
    const boardResult = await db.collection("ops_board_entries").insertMany(
      boardData.map((b) => ({ ...b })),
    );
    console.log(`Inserted ${Object.keys(boardResult.insertedIds).length} board entries.`);

    // Create indexes
    await db.collection("ops_issues").createIndex({ status: 1 });
    await db.collection("ops_issues").createIndex({ "aiAnalysis.category": 1 });
    await db.collection("ops_issues").createIndex({ "aiAnalysis.urgency": 1 });
    await db.collection("ops_issues").createIndex({ createdAt: -1 });
    await db.collection("ops_staff").createIndex({ isActive: 1, name: 1 });
    await db.collection("ops_handovers").createIndex({ createdAt: -1 });
    await db.collection("ops_board_entries").createIndex({ type: 1 });
    await db.collection("ops_board_entries").createIndex({ createdAt: -1 });
    console.log("Indexes created.");

    console.log("\nSeed complete! Collections seeded:");
    console.log(`  ops_staff: ${staffIds.length} documents`);
    console.log(`  ops_issues: ${issueIds.length} documents`);
    console.log(`  ops_handovers: ${Object.keys(handoverResult.insertedIds).length} documents`);
    console.log(`  ops_board_entries: ${Object.keys(boardResult.insertedIds).length} documents`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
