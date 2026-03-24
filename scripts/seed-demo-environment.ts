import { loadEnvConfig } from "@next/env";
import { ObjectId } from "mongodb";
import { getMongoClient, getMongoDb } from "../src/lib/mongodb";
import { buildCreateMetadata } from "../src/lib/domain-write";
import { type AppRole } from "../src/lib/navigation";
import { allPermissionCatalog, expandPermissionCodes } from "../src/lib/permission-catalog";

loadEnvConfig(process.cwd());

const SEED_TAG = "sw-erp-demo-v20260324";
const BASE_TIME = new Date("2026-03-01T00:00:00.000Z");
const seedProfile = {
  displayName: "ERP Demo Seeder",
  orgUnitName: "시스템",
  email: "seed.bot@local.erp",
};

const shouldDryRun = process.argv.includes("--dry-run");
const shouldReset = !process.argv.includes("--no-reset");

const collectionNames = [
  // auth & admin
  "orgUnits", "roles", "users", "policies", "auditLogs",
  // workspace
  "approvalHistory", "approvalTasks", "savedViews", "notifications", "workspacePosts",
  // facilities
  "facilities",
  // client-case
  "clients", "needs_assessments", "case_plans", "service_linkages", "counseling_records", "case_closures",
  // programs
  "programs", "program_sessions", "program_participants", "satisfaction_surveys", "performance_evaluations",
  // donation-volunteer
  "donors", "donations", "in_kind_donations", "volunteers", "volunteer_activities", "volunteer_hours",
  // facility-hr
  "staff", "hr_attendance", "facility_rooms", "facility_supplies", "vehicles", "vehicle_schedules",
  // finance
  "accounting_units", "chart_of_accounts", "journal_entries", "ap_invoices", "ar_invoices", "fixed_assets", "subsidies", "counters",
  // approval & docs
  "approval_documents", "approval_templates", "circulation_posts", "document_issues", "official_numbers",
  // schedule & work-log
  "schedules", "work_logs",
  // statistics & integration
  "statistics_snapshots", "integration_logs", "integration_configs",
];

function addDays(days: number, hour = 9, minute = 0) {
  const next = new Date(BASE_TIME);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

function isoDate(days: number) {
  return addDays(days).toISOString().slice(0, 10);
}

function isoTimestamp(days: number, hour = 9, minute = 0) {
  return addDays(days, hour, minute).toISOString();
}

function makeDoc<T extends Record<string, unknown>>(
  doc: T,
  days = 0,
  hour = 9,
): T & { seedTag: string } & ReturnType<typeof buildCreateMetadata> {
  const now = isoTimestamp(days, hour);
  return {
    ...doc,
    seedTag: SEED_TAG,
    ...buildCreateMetadata(seedProfile, now),
  } as T & { seedTag: string } & ReturnType<typeof buildCreateMetadata>;
}

function makeActor(displayName: string, orgUnitName: string, email: string) {
  return { userId: email, employeeNo: "", displayName, orgUnitName };
}

function makeFacilitySnapshot(facilityId: string, facilityCode: string, name: string, facilityType: string) {
  return { facilityId, facilityCode, name, facilityType };
}

// ─── Main ──────────────────────────────────────────

async function main() {
  const client = await getMongoClient();
  const db = await getMongoDb();

  console.log(`Seed tag: ${SEED_TAG}`);
  console.log(`Dry run: ${shouldDryRun}`);
  console.log(`Reset: ${shouldReset}`);

  // ── Reset ──
  if (shouldReset && !shouldDryRun) {
    console.log("\n🗑️  Resetting seeded data...");
    for (const name of collectionNames) {
      const result = await db.collection(name).deleteMany({ seedTag: SEED_TAG });
      if (result.deletedCount > 0) {
        console.log(`   ${name}: deleted ${result.deletedCount}`);
      }
    }
  }

  // ── IDs ──
  const facilityId1 = new ObjectId();
  const facilityId2 = new ObjectId();
  const orgUnitId1 = new ObjectId();
  const orgUnitId2 = new ObjectId();
  const orgUnitId3 = new ObjectId();
  const roleAdminId = new ObjectId();
  const roleLeadId = new ObjectId();
  const roleExecId = new ObjectId();
  const userAdminId = new ObjectId();
  const userLeadId = new ObjectId();
  const userExecId = new ObjectId();
  const userWorker1Id = new ObjectId();
  const userWorker2Id = new ObjectId();

  const fs1 = makeFacilitySnapshot(facilityId1.toString(), "FAC-202603-0001", "행복종합사회복지관", "종합사회복지관");
  const fs2 = makeFacilitySnapshot(facilityId2.toString(), "FAC-202603-0002", "은빛노인요양원", "노인요양시설");

  const adminActor = makeActor("김관리", "정보기술팀", "admin@welfare.local");
  const leadActor = makeActor("박시설", "사회복지관", "lead@welfare.local");
  const worker1Actor = makeActor("이사복", "사례관리팀", "worker1@welfare.local");
  const worker2Actor = makeActor("최봉사", "자원봉사팀", "worker2@welfare.local");

  // ── Facilities ──
  const facilities = [
    makeDoc({ _id: facilityId1, facilityCode: "FAC-202603-0001", name: "행복종합사회복지관", facilityType: "종합사회복지관", address: "서울시 강남구 행복로 123", phone: "02-1234-5678", capacity: 200, director: "박시설", status: "active" }, 0),
    makeDoc({ _id: facilityId2, facilityCode: "FAC-202603-0002", name: "은빛노인요양원", facilityType: "노인요양시설", address: "서울시 서초구 은빛로 45", phone: "02-9876-5432", capacity: 80, director: "정요양", status: "active" }, 0),
  ];

  // ── Org Units ──
  const orgUnits = [
    makeDoc({ _id: orgUnitId1, code: "IT", name: "정보기술팀", parentId: null, status: "active" }),
    makeDoc({ _id: orgUnitId2, code: "SW", name: "사례관리팀", parentId: null, status: "active" }),
    makeDoc({ _id: orgUnitId3, code: "VOL", name: "자원봉사팀", parentId: null, status: "active" }),
  ];

  // ── Roles ──
  const allReadWrite = [...allPermissionCatalog];
  const allRead = allPermissionCatalog.filter((p) => p.endsWith(".read"));

  const roles = [
    makeDoc({ _id: roleAdminId, roleName: "시스템 관리자", description: "전체 시스템 관리 권한", permissions: allReadWrite, expandedPermissions: expandPermissionCodes(allReadWrite), status: "active" }),
    makeDoc({ _id: roleLeadId, roleName: "시설장", description: "시설 운영 전체 관리", permissions: allReadWrite.filter((c) => c !== "admin.write"), expandedPermissions: expandPermissionCodes(allReadWrite.filter((c) => c !== "admin.write")), status: "active" }),
    makeDoc({ _id: roleExecId, roleName: "이사", description: "열람 전용", permissions: allRead, expandedPermissions: expandPermissionCodes(allRead), status: "active" }),
  ];

  // ── Users ──
  const users = [
    makeDoc({ _id: userAdminId, googleId: "admin-google-id", displayName: "김관리", email: "admin@welfare.local", avatarUrl: "", roleId: roleAdminId.toString(), orgUnitId: orgUnitId1.toString(), orgUnitName: "정보기술팀", roleLabel: "시스템 관리자", status: "active" }),
    makeDoc({ _id: userLeadId, googleId: "lead-google-id", displayName: "박시설", email: "lead@welfare.local", avatarUrl: "", roleId: roleLeadId.toString(), orgUnitId: orgUnitId2.toString(), orgUnitName: "사례관리팀", roleLabel: "시설장", status: "active" }),
    makeDoc({ _id: userExecId, googleId: "exec-google-id", displayName: "정이사", email: "exec@welfare.local", avatarUrl: "", roleId: roleExecId.toString(), orgUnitId: orgUnitId1.toString(), orgUnitName: "이사회", roleLabel: "이사", status: "active" }),
    makeDoc({ _id: userWorker1Id, googleId: "worker1-google-id", displayName: "이사복", email: "worker1@welfare.local", avatarUrl: "", roleId: roleLeadId.toString(), orgUnitId: orgUnitId2.toString(), orgUnitName: "사례관리팀", roleLabel: "사회복지사", status: "active" }),
    makeDoc({ _id: userWorker2Id, googleId: "worker2-google-id", displayName: "최봉사", email: "worker2@welfare.local", avatarUrl: "", roleId: roleLeadId.toString(), orgUnitId: orgUnitId3.toString(), orgUnitName: "자원봉사팀", roleLabel: "사회복지사", status: "active" }),
  ];

  // ── Clients ──
  const clientIds = Array.from({ length: 8 }, () => new ObjectId());
  const clients = [
    makeDoc({ _id: clientIds[0], clientNo: "CL-202603-0001", name: "홍길동", birthDate: "1955-03-15", gender: "남", phone: "010-1111-2222", address: "서울시 강남구", registrationDate: isoDate(1), registrationType: "신규", careLevel: "3등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "배우자", name: "김옥순", contact: "010-3333-4444" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 1),
    makeDoc({ _id: clientIds[1], clientNo: "CL-202603-0002", name: "김영희", birthDate: "1948-07-20", gender: "여", phone: "010-2222-3333", address: "서울시 서초구", registrationDate: isoDate(1), registrationType: "신규", careLevel: "2등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: true, disabilityType: "지체장애", disabilityGrade: "3급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 1),
    makeDoc({ _id: clientIds[2], clientNo: "CL-202603-0003", name: "박철수", birthDate: "1960-11-05", gender: "남", phone: "010-4444-5555", address: "서울시 송파구", registrationDate: isoDate(2), registrationType: "의뢰", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "박미래", contact: "010-6666-7777" }], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 2),
    makeDoc({ _id: clientIds[3], clientNo: "CL-202603-0004", name: "이순신", birthDate: "1942-01-10", gender: "남", phone: "010-5555-6666", address: "서울시 종로구", registrationDate: isoDate(3), registrationType: "재등록", careLevel: "1등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "시각장애", disabilityGrade: "2급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 3),
    makeDoc({ _id: clientIds[4], clientNo: "CL-202603-0005", name: "정미숙", birthDate: "1970-05-25", gender: "여", phone: "010-7777-8888", address: "서울시 마포구", registrationDate: isoDate(3), registrationType: "신규", careLevel: "해당없음", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 3),
    makeDoc({ _id: clientIds[5], clientNo: "CL-202603-0006", name: "강감찬", birthDate: "1938-09-12", gender: "남", phone: "010-8888-9999", address: "서울시 강서구", registrationDate: isoDate(4), registrationType: "신규", careLevel: "4등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "강민수", contact: "010-1111-0000" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 4),
    makeDoc({ _id: clientIds[6], clientNo: "CL-202603-0007", name: "유관순", birthDate: "1975-08-30", gender: "여", phone: "010-9999-0000", address: "서울시 동대문구", registrationDate: isoDate(5), registrationType: "신규", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: true, disabilityType: "청각장애", disabilityGrade: "4급" }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 5),
    makeDoc({ _id: clientIds[7], clientNo: "CL-202603-0008", name: "안중근", birthDate: "1950-12-01", gender: "남", phone: "010-0000-1111", address: "서울시 용산구", registrationDate: isoDate(6), registrationType: "의뢰", careLevel: "5등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "inactive", changeHistory: [] }, 6),
  ];

  // ── Needs Assessments ──
  const naIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const needsAssessments = [
    makeDoc({ _id: naIds[0], assessmentNo: "NA-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동", birthDate: "1955-03-15", gender: "남" }, domains: [{ domainName: "건강", score: 3, priority: "높음" }, { domainName: "경제", score: 4, priority: "중간" }, { domainName: "사회관계", score: 2, priority: "높음" }], overallScore: 3.0, facilitySnapshot: fs1, status: "completed" }, 3),
    makeDoc({ _id: naIds[1], assessmentNo: "NA-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희", birthDate: "1948-07-20", gender: "여" }, domains: [{ domainName: "건강", score: 2, priority: "높음" }, { domainName: "일상생활", score: 3, priority: "중간" }], overallScore: 2.5, facilitySnapshot: fs1, status: "completed" }, 4),
    makeDoc({ _id: naIds[2], assessmentNo: "NA-202603-0003", clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신", birthDate: "1942-01-10", gender: "남" }, domains: [{ domainName: "건강", score: 1, priority: "높음" }, { domainName: "경제", score: 2, priority: "높음" }, { domainName: "주거", score: 3, priority: "중간" }], overallScore: 2.0, facilitySnapshot: fs2, status: "completed" }, 5),
  ];

  // ── Case Plans ──
  const cpIds = [new ObjectId(), new ObjectId()];
  const casePlans = [
    makeDoc({ _id: cpIds[0], planNo: "CP-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, assessmentSnapshot: { assessmentId: naIds[0].toString(), assessmentNo: "NA-202603-0001" }, goals: [{ domain: "건강", longTermGoal: "건강상태 유지", shortTermGoals: ["정기 건강검진", "운동 프로그램 참여"], interventions: ["방문간호", "운동교실 연계"] }, { domain: "사회관계", longTermGoal: "사회적 관계망 확대", shortTermGoals: ["프로그램 참여"], interventions: ["노인대학 연계"] }], facilitySnapshot: fs1, status: "in-progress" }, 5),
    makeDoc({ _id: cpIds[1], planNo: "CP-202603-0002", clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신" }, assessmentSnapshot: { assessmentId: naIds[2].toString(), assessmentNo: "NA-202603-0003" }, goals: [{ domain: "건강", longTermGoal: "시각장애 관리", shortTermGoals: ["안과 정기 검진"], interventions: ["의료기관 연계"] }], facilitySnapshot: fs2, status: "approved" }, 7),
  ];

  // ── Service Linkages ──
  const serviceLinkages = [
    makeDoc({ linkageNo: "SL-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, linkageType: "외부", serviceCategory: "의료", referralOrg: "강남구보건소", referralDate: isoDate(6), facilitySnapshot: fs1, status: "active" }, 6),
    makeDoc({ linkageNo: "SL-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희" }, linkageType: "내부", serviceCategory: "재활", referralOrg: "", referralDate: isoDate(7), facilitySnapshot: fs1, status: "active" }, 7),
  ];

  // ── Counseling Records ──
  const counselingRecords = [
    makeDoc({ counselingNo: "CR-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, sessionType: "대면", duration: 60, content: "건강 상태 점검 및 프로그램 참여 의향 확인", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 4),
    makeDoc({ counselingNo: "CR-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희" }, sessionType: "전화", duration: 30, content: "재활 프로그램 안내 및 일정 조율", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ counselingNo: "CR-202603-0003", clientSnapshot: { clientId: clientIds[2].toString(), clientNo: "CL-202603-0003", name: "박철수" }, sessionType: "방문", duration: 90, content: "가정 방문을 통한 생활환경 점검", counselorSnapshot: worker2Actor, facilitySnapshot: fs1, status: "completed" }, 8),
  ];

  // ── Case Closures ──
  const caseClosures = [
    makeDoc({ closureNo: "CC-202603-0001", clientSnapshot: { clientId: clientIds[7].toString(), clientNo: "CL-202603-0008", name: "안중근" }, casePlanSnapshot: null, closureReason: "타 지역 전출", goalEvaluations: [], followUpPlan: "전출지 복지관에 인수인계", facilitySnapshot: fs2, status: "approved" }, 10),
  ];

  // ── Programs ──
  const programIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const programs = [
    makeDoc({ _id: programIds[0], programNo: "PGM-202603-0001", name: "실버건강교실", category: "건강증진", targetGroup: "65세 이상", objectives: "노인 체력 향상 및 건강 유지", totalSessions: 12, maxParticipants: 20, budget: 5000000, fundingSource: "보조금", facilitySnapshot: fs1, status: "in-progress" }, 2),
    makeDoc({ _id: programIds[1], programNo: "PGM-202603-0002", name: "아동방과후교실", category: "교육지원", targetGroup: "초등학생", objectives: "학습 능력 향상 및 돌봄 지원", totalSessions: 20, maxParticipants: 15, budget: 3000000, fundingSource: "자체예산", facilitySnapshot: fs1, status: "recruiting" }, 3),
    makeDoc({ _id: programIds[2], programNo: "PGM-202603-0003", name: "치매예방프로그램", category: "치매예방", targetGroup: "60세 이상", objectives: "인지기능 유지 및 치매 예방", totalSessions: 16, maxParticipants: 12, budget: 4000000, fundingSource: "보조금", facilitySnapshot: fs2, status: "in-progress" }, 4),
  ];

  // ── Program Sessions ──
  const programSessions = [
    makeDoc({ sessionNo: "PSN-202603-0001", programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, sessionNumber: 1, title: "오리엔테이션", sessionDate: isoDate(5), location: "다목적실", attendeeCount: 18, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ sessionNo: "PSN-202603-0002", programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, sessionNumber: 2, title: "스트레칭 기초", sessionDate: isoDate(8), location: "다목적실", attendeeCount: 17, facilitySnapshot: fs1, status: "completed" }, 8),
    makeDoc({ sessionNo: "PSN-202603-0003", programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, sessionNumber: 1, title: "인지검사 안내", sessionDate: isoDate(7), location: "프로그램실", attendeeCount: 10, facilitySnapshot: fs2, status: "completed" }, 7),
  ];

  // ── Donors ──
  const donorIds = [new ObjectId(), new ObjectId()];
  const donors = [
    makeDoc({ _id: donorIds[0], donorNo: "DNR-202603-0001", donorType: "individual", name: "김후원", taxIdNo: "", donorCategory: "정기", facilitySnapshot: fs1, status: "active" }, 1),
    makeDoc({ _id: donorIds[1], donorNo: "DNR-202603-0002", donorType: "corporate", name: "(주)사랑나눔", taxIdNo: "123-45-67890", donorCategory: "비정기", facilitySnapshot: fs1, status: "active" }, 2),
  ];

  // ── Donations ──
  const donations = [
    makeDoc({ donationNo: "DON-202603-0001", donorSnapshot: { donorId: donorIds[0].toString(), donorNo: "DNR-202603-0001", name: "김후원" }, donationType: "현금", amount: 100000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ donationNo: "DON-202603-0002", donorSnapshot: { donorId: donorIds[0].toString(), donorNo: "DNR-202603-0001", name: "김후원" }, donationType: "현금", amount: 100000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 10),
    makeDoc({ donationNo: "DON-202603-0003", donorSnapshot: { donorId: donorIds[1].toString(), donorNo: "DNR-202603-0002", name: "(주)사랑나눔" }, donationType: "현금", amount: 5000000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 15),
  ];

  // ── In-Kind Donations ──
  const inKindDonations = [
    makeDoc({ donationNo: "IKD-202603-0001", donorSnapshot: { donorId: donorIds[1].toString(), donorNo: "DNR-202603-0002", name: "(주)사랑나눔" }, itemName: "쌀 20kg", quantity: 50, estimatedValue: 2500000, distributedTo: "이용자 가정", facilitySnapshot: fs1, status: "distributed" }, 7),
  ];

  // ── Volunteers ──
  const volunteerIds = [new ObjectId(), new ObjectId()];
  const volunteers = [
    makeDoc({ _id: volunteerIds[0], volunteerNo: "VOL-202603-0001", name: "한봉사", phone: "010-1234-0001", skills: ["요리", "운전"], availableDays: ["월", "수", "금"], orientation1365Id: "1365-001", totalHours: 48, facilitySnapshot: fs1, status: "active" }, 1),
    makeDoc({ _id: volunteerIds[1], volunteerNo: "VOL-202603-0002", name: "오도움", phone: "010-1234-0002", skills: ["교육", "상담"], availableDays: ["화", "목"], orientation1365Id: "1365-002", totalHours: 24, facilitySnapshot: fs1, status: "active" }, 2),
  ];

  // ── Volunteer Activities ──
  const volunteerActivities = [
    makeDoc({ activityNo: "VA-202603-0001", title: "급식봉사", category: "배식", assignedVolunteers: [volunteerIds[0].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(6), facilitySnapshot: fs1, status: "completed" }, 6),
    makeDoc({ activityNo: "VA-202603-0002", title: "학습지도", category: "교육", assignedVolunteers: [volunteerIds[1].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(8), facilitySnapshot: fs1, status: "completed" }, 8),
  ];

  // ── Volunteer Hours ──
  const volunteerHours = [
    makeDoc({ hoursNo: "VH-202603-0001", volunteerSnapshot: { volunteerId: volunteerIds[0].toString(), volunteerNo: "VOL-202603-0001", name: "한봉사" }, activitySnapshot: { activityNo: "VA-202603-0001", title: "급식봉사" }, hours: 4, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 6),
    makeDoc({ hoursNo: "VH-202603-0002", volunteerSnapshot: { volunteerId: volunteerIds[1].toString(), volunteerNo: "VOL-202603-0002", name: "오도움" }, activitySnapshot: { activityNo: "VA-202603-0002", title: "학습지도" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 8),
  ];

  // ── Staff ──
  const staffIds = [new ObjectId(), new ObjectId(), new ObjectId()];
  const staffDocs = [
    makeDoc({ _id: staffIds[0], staffNo: "STF-202603-0001", name: "이사복", position: "사회복지사", department: "사례관리팀", contractType: "정규직", qualifications: ["사회복지사 1급"], trainings: [{ name: "사례관리 실무교육", completedDate: "2026-01-15" }], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[1], staffNo: "STF-202603-0002", name: "최봉사", position: "사회복지사", department: "자원봉사팀", contractType: "정규직", qualifications: ["사회복지사 2급"], trainings: [], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[2], staffNo: "STF-202603-0003", name: "김간호", position: "간호사", department: "건강관리팀", contractType: "계약직", qualifications: ["간호사 면허"], trainings: [{ name: "치매관리 교육", completedDate: "2026-02-10" }], facilitySnapshot: fs2, status: "active" }, 0),
  ];

  // ── HR Attendance ──
  const hrAttendance = [
    makeDoc({ attendanceNo: "ATT-202603-0001", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, date: isoDate(10), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0002", staffSnapshot: { staffId: staffIds[1].toString(), staffNo: "STF-202603-0002", name: "최봉사" }, date: isoDate(10), scheduleType: "주간", checkInTime: "09:15", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "late" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0003", staffSnapshot: { staffId: staffIds[2].toString(), staffNo: "STF-202603-0003", name: "김간호" }, date: isoDate(10), scheduleType: "주간", checkInTime: null, checkOutTime: null, leaveType: "연차", facilitySnapshot: fs2, status: "leave" }, 10),
  ];

  // ── Facility Rooms ──
  const facilityRooms = [
    makeDoc({ roomNo: "RM-202603-0001", name: "다목적실", floor: "1층", roomType: "프로그램실", capacity: 30, equipment: ["빔프로젝터", "음향장비"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0002", name: "상담실 A", floor: "2층", roomType: "상담실", capacity: 4, equipment: ["테이블", "의자"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0003", name: "요양실 101", floor: "1층", roomType: "요양실", capacity: 4, equipment: ["의료침대", "커튼"], facilitySnapshot: fs2, status: "active" }, 0),
  ];

  // ── Facility Supplies ──
  const facilitySupplies = [
    makeDoc({ supplyNo: "SUP-202603-0001", itemName: "A4 용지", category: "사무용품", currentStock: 50, minimumStock: 10, unitPrice: 5000, facilitySnapshot: fs1, status: "adequate" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0002", itemName: "손소독제", category: "위생용품", currentStock: 3, minimumStock: 5, unitPrice: 8000, facilitySnapshot: fs1, status: "low-stock" }, 0),
  ];

  // ── Vehicles ──
  const vehicleIds = [new ObjectId()];
  const vehicles = [
    makeDoc({ _id: vehicleIds[0], vehicleNo: "VEH-202603-0001", licensePlate: "12가 3456", vehicleType: "승합차", purpose: "이용자 송영", maintenanceLogs: [{ date: isoDate(1), type: "정기점검", cost: 150000 }], facilitySnapshot: fs1, status: "active" }, 0),
  ];

  // ── Subsidies ──
  const subsidies = [
    makeDoc({ subsidyNo: "GRT-202603-0001", grantName: "2026년 사회복지관 운영비", grantingAuthority: "보건복지부", grantType: "운영비", fiscalYear: 2026, grantAmount: 500000000, receivedAmount: 250000000, usedAmount: 120000000, reportingSchedule: [{ period: "1분기", dueDate: "2026-04-15", status: "pending" }], facilitySnapshot: fs1, status: "active" }, 1),
    makeDoc({ subsidyNo: "GRT-202603-0002", grantName: "2026년 노인요양시설 보조금", grantingAuthority: "서울특별시", grantType: "시설보조금", fiscalYear: 2026, grantAmount: 200000000, receivedAmount: 100000000, usedAmount: 45000000, reportingSchedule: [{ period: "1분기", dueDate: "2026-04-15", status: "pending" }], facilitySnapshot: fs2, status: "active" }, 1),
  ];

  // ── Approval Documents ──
  const approvalDocuments = [
    makeDoc({ documentNo: "APD-202603-0001", title: "3월 사례회의 결과보고", documentType: "사례회의록", content: "3월 정기 사례회의 결과를 보고합니다.", drafterId: userWorker1Id.toString(), drafterSnapshot: worker1Actor, approvalLine: [{ step: 1, role: "주임", approverId: userWorker1Id.toString(), approverName: "이사복", status: "approved", decidedAt: isoTimestamp(12) }, { step: 2, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "pending", decidedAt: null }, { step: 3, role: "센터장", approverId: userAdminId.toString(), approverName: "김관리", status: "pending", decidedAt: null }], currentStep: 2, facilitySnapshot: fs1, overallStatus: "submitted" }, 11),
    makeDoc({ documentNo: "APD-202603-0002", title: "출장복명서 - 서울시 사회복지 협의회", documentType: "출장복명서", content: "서울시 사회복지 협의회 참석 복명", drafterId: userWorker2Id.toString(), drafterSnapshot: worker2Actor, approvalLine: [{ step: 1, role: "주임", approverId: userWorker2Id.toString(), approverName: "최봉사", status: "approved", decidedAt: isoTimestamp(14) }, { step: 2, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "approved", decidedAt: isoTimestamp(15) }, { step: 3, role: "센터장", approverId: userAdminId.toString(), approverName: "김관리", status: "approved", decidedAt: isoTimestamp(16) }], currentStep: 3, facilitySnapshot: fs1, overallStatus: "final-approved" }, 13),
  ];

  // ── Circulation Posts ──
  const circulationPosts = [
    makeDoc({ circulationNo: "CRC-202603-0001", title: "3월 직원 교육 안내", content: "3월 25일 오후 2시 직원 교육이 진행됩니다.", authorSnapshot: adminActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(9) }], unviewedCount: 2, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 8),
    makeDoc({ circulationNo: "CRC-202603-0002", title: "시설 안전점검 결과", content: "2월 안전점검 결과를 공람합니다.", authorSnapshot: leadActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userAdminId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(11) }, { userId: userAdminId.toString(), viewedAt: isoTimestamp(11) }], unviewedCount: 1, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 10),
  ];

  // ── Schedules ──
  const schedules = [
    makeDoc({ scheduleNo: "SCH-202603-0001", title: "사례회의", date: isoDate(24), startTime: "10:00", endTime: "12:00", location: "다목적실", category: "회의", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], memo: "3월 정기 사례회의", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0002", title: "서울시 사회복지 협의회", date: isoDate(24), startTime: "14:00", endTime: "16:00", location: "서울시청", category: "외부출장", participants: [userLeadId.toString()], memo: "분기별 협의회 참석", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0003", title: "실버건강교실 3회차", date: isoDate(24), startTime: "10:00", endTime: "11:30", location: "다목적실", category: "사례관리", participants: [], memo: "", facilitySnapshot: fs1, status: "scheduled" }, 20),
  ];

  // ── Work Logs ──
  const workLogs = [
    makeDoc({ workLogNo: "WL-202603-0001", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, weekStartDate: isoDate(10), weekEndDate: isoDate(14), dailyEntries: [{ date: isoDate(10), tasks: ["사례회의 준비", "홍길동 상담"], notes: "" }, { date: isoDate(11), tasks: ["김영희 가정방문", "서류정리"], notes: "방문 시 건강 악화 징후 확인" }], weeklyGoals: "사례관리 3건 완료", achievements: "2건 완료, 1건 진행중", nextWeekPlan: "박철수 사례 중간평가", submittedAt: isoTimestamp(14, 17), facilitySnapshot: fs1, status: "submitted" }, 14),
  ];

  // ── Integration Configs ──
  const integrationConfigs = [
    makeDoc({ systemCode: "himange", systemName: "희망e음", apiBaseUrl: "https://api.himange.go.kr", enabled: false, lastSyncAt: null, syncSchedule: "daily", fieldMappings: [], facilitySnapshot: fs1 }),
    makeDoc({ systemCode: "botame", systemName: "보탬e", apiBaseUrl: "https://api.botame.go.kr", enabled: false, lastSyncAt: null, syncSchedule: "weekly", fieldMappings: [], facilitySnapshot: fs1 }),
    makeDoc({ systemCode: "enaradoreum", systemName: "e나라도움", apiBaseUrl: "https://api.enaradoreum.go.kr", enabled: false, lastSyncAt: null, syncSchedule: "monthly", fieldMappings: [], facilitySnapshot: fs1 }),
    makeDoc({ systemCode: "swis", systemName: "사회복지시설정보시스템", apiBaseUrl: "https://api.swis.go.kr", enabled: false, lastSyncAt: null, syncSchedule: "monthly", fieldMappings: [], facilitySnapshot: fs1 }),
    makeDoc({ systemCode: "vol1365", systemName: "1365 자원봉사포털", apiBaseUrl: "https://api.1365.go.kr", enabled: false, lastSyncAt: null, syncSchedule: "weekly", fieldMappings: [], facilitySnapshot: fs1 }),
  ];

  // ── Accounting Units ──
  const acctUnitId = new ObjectId();
  const accountingUnits = [
    makeDoc({ _id: acctUnitId, code: "HQ-001", name: "행복종합사회복지관 회계", currency: "KRW", country: "KR", facilitySnapshot: fs1, status: "active" }),
  ];

  // ── Insert All ──
  if (shouldDryRun) {
    console.log("\n📋 Dry run — no data inserted.");
    const allData: Record<string, unknown[]> = {
      facilities, orgUnits, roles, users, clients, needs_assessments: needsAssessments,
      case_plans: casePlans, service_linkages: serviceLinkages, counseling_records: counselingRecords,
      case_closures: caseClosures, programs, program_sessions: programSessions,
      donors, donations, in_kind_donations: inKindDonations,
      volunteers, volunteer_activities: volunteerActivities, volunteer_hours: volunteerHours,
      staff: staffDocs, hr_attendance: hrAttendance,
      facility_rooms: facilityRooms, facility_supplies: facilitySupplies,
      vehicles, subsidies,
      approval_documents: approvalDocuments, circulation_posts: circulationPosts,
      schedules, work_logs: workLogs,
      integration_configs: integrationConfigs, accounting_units: accountingUnits,
    };
    for (const [name, docs] of Object.entries(allData)) {
      console.log(`   ${name}: ${docs.length} documents`);
    }
  } else {
    console.log("\n📦 Inserting seed data...");

    const insertions: [string, unknown[]][] = [
      ["facilities", facilities],
      ["orgUnits", orgUnits],
      ["roles", roles],
      ["users", users],
      ["clients", clients],
      ["needs_assessments", needsAssessments],
      ["case_plans", casePlans],
      ["service_linkages", serviceLinkages],
      ["counseling_records", counselingRecords],
      ["case_closures", caseClosures],
      ["programs", programs],
      ["program_sessions", programSessions],
      ["donors", donors],
      ["donations", donations],
      ["in_kind_donations", inKindDonations],
      ["volunteers", volunteers],
      ["volunteer_activities", volunteerActivities],
      ["volunteer_hours", volunteerHours],
      ["staff", staffDocs],
      ["hr_attendance", hrAttendance],
      ["facility_rooms", facilityRooms],
      ["facility_supplies", facilitySupplies],
      ["vehicles", vehicles],
      ["subsidies", subsidies],
      ["approval_documents", approvalDocuments],
      ["circulation_posts", circulationPosts],
      ["schedules", schedules],
      ["work_logs", workLogs],
      ["integration_configs", integrationConfigs],
      ["accounting_units", accountingUnits],
    ];

    for (const [collectionName, docs] of insertions) {
      if (docs.length === 0) continue;
      const result = await db.collection(collectionName).insertMany(docs as Record<string, unknown>[]);
      console.log(`   ✅ ${collectionName}: ${result.insertedCount} inserted`);
    }
  }

  console.log("\n🎉 Seed complete!");
  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
