import { loadEnvConfig } from "@next/env";
import { ObjectId } from "mongodb";
import { getMongoClient, getMongoDb } from "../src/lib/mongodb";
import { buildCreateMetadata } from "../src/lib/domain-write";
import { type AppRole } from "../src/lib/navigation";
import { allPermissionCatalog, expandPermissionCodes } from "../src/lib/permission-catalog";

loadEnvConfig(process.cwd());

const SEED_TAG = "sw-erp-demo-v20260325";
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
  const clientIds = Array.from({ length: 20 }, () => new ObjectId());
  const clients = [
    makeDoc({ _id: clientIds[0], clientNo: "CL-202603-0001", name: "홍길동", birthDate: "1955-03-15", gender: "남", phone: "010-1111-2222", address: "서울시 강남구", registrationDate: isoDate(1), registrationType: "신규", careLevel: "3등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "배우자", name: "김옥순", contact: "010-3333-4444" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 1),
    makeDoc({ _id: clientIds[1], clientNo: "CL-202603-0002", name: "김영희", birthDate: "1948-07-20", gender: "여", phone: "010-2222-3333", address: "서울시 서초구", registrationDate: isoDate(1), registrationType: "신규", careLevel: "2등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: true, disabilityType: "지체장애", disabilityGrade: "3급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 1),
    makeDoc({ _id: clientIds[2], clientNo: "CL-202603-0003", name: "박철수", birthDate: "1960-11-05", gender: "남", phone: "010-4444-5555", address: "서울시 송파구", registrationDate: isoDate(2), registrationType: "의뢰", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "박미래", contact: "010-6666-7777" }], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 2),
    makeDoc({ _id: clientIds[3], clientNo: "CL-202603-0004", name: "이순신", birthDate: "1942-01-10", gender: "남", phone: "010-5555-6666", address: "서울시 종로구", registrationDate: isoDate(3), registrationType: "재등록", careLevel: "1등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "시각장애", disabilityGrade: "2급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 3),
    makeDoc({ _id: clientIds[4], clientNo: "CL-202603-0005", name: "정미숙", birthDate: "1970-05-25", gender: "여", phone: "010-7777-8888", address: "서울시 마포구", registrationDate: isoDate(3), registrationType: "신규", careLevel: "해당없음", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 3),
    makeDoc({ _id: clientIds[5], clientNo: "CL-202603-0006", name: "강감찬", birthDate: "1938-09-12", gender: "남", phone: "010-8888-9999", address: "서울시 강서구", registrationDate: isoDate(4), registrationType: "신규", careLevel: "4등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "강민수", contact: "010-1111-0000" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 4),
    makeDoc({ _id: clientIds[6], clientNo: "CL-202603-0007", name: "유관순", birthDate: "1975-08-30", gender: "여", phone: "010-9999-0000", address: "서울시 동대문구", registrationDate: isoDate(5), registrationType: "신규", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: true, disabilityType: "청각장애", disabilityGrade: "4급" }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 5),
    makeDoc({ _id: clientIds[7], clientNo: "CL-202603-0008", name: "안중근", birthDate: "1950-12-01", gender: "남", phone: "010-0000-1111", address: "서울시 용산구", registrationDate: isoDate(6), registrationType: "의뢰", careLevel: "5등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "inactive", changeHistory: [] }, 6),
    makeDoc({ _id: clientIds[8], clientNo: "CL-202603-0009", name: "송민지", birthDate: "1965-04-18", gender: "여", phone: "010-1234-5001", address: "서울시 성북구", registrationDate: isoDate(2), registrationType: "신규", careLevel: "3등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "송하은", contact: "010-1234-5002" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 2),
    makeDoc({ _id: clientIds[9], clientNo: "CL-202603-0010", name: "조영수", birthDate: "1952-06-22", gender: "남", phone: "010-1234-5003", address: "서울시 광진구", registrationDate: isoDate(3), registrationType: "의뢰", careLevel: "2등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "지체장애", disabilityGrade: "2급" }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 3),
    makeDoc({ _id: clientIds[10], clientNo: "CL-202603-0011", name: "윤희정", birthDate: "1940-02-14", gender: "여", phone: "010-1234-5004", address: "서울시 중구", registrationDate: isoDate(4), registrationType: "재등록", careLevel: "1등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "뇌병변장애", disabilityGrade: "1급" }, familyInfo: [{ relation: "배우자", name: "윤석호", contact: "010-1234-5005" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 4),
    makeDoc({ _id: clientIds[11], clientNo: "CL-202603-0012", name: "한상우", birthDate: "1935-10-09", gender: "남", phone: "010-1234-5006", address: "서울시 종로구 세종로", registrationDate: isoDate(5), registrationType: "신규", careLevel: "1등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "시각장애", disabilityGrade: "1급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "deceased", changeHistory: [{ date: isoDate(20), type: "사망", note: "노환으로 별세" }] }, 5),
    makeDoc({ _id: clientIds[12], clientNo: "CL-202603-0013", name: "배수진", birthDate: "1968-12-30", gender: "여", phone: "010-1234-5007", address: "서울시 서대문구", registrationDate: isoDate(5), registrationType: "신규", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "배우자", name: "배진호", contact: "010-1234-5008" }], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 5),
    makeDoc({ _id: clientIds[13], clientNo: "CL-202603-0014", name: "임동혁", birthDate: "1958-03-08", gender: "남", phone: "010-1234-5009", address: "서울시 노원구", registrationDate: isoDate(6), registrationType: "신규", careLevel: "4등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 6),
    makeDoc({ _id: clientIds[14], clientNo: "CL-202603-0015", name: "노경숙", birthDate: "1943-07-19", gender: "여", phone: "010-1234-5010", address: "서울시 강동구", registrationDate: isoDate(7), registrationType: "의뢰", careLevel: "2등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "노재현", contact: "010-1234-5011" }], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 7),
    makeDoc({ _id: clientIds[15], clientNo: "CL-202603-0016", name: "서재원", birthDate: "1950-08-03", gender: "남", phone: "010-1234-5012", address: "서울시 관악구", registrationDate: isoDate(8), registrationType: "재등록", careLevel: "3등급", incomeLevel: "차상위", disabilityInfo: { hasDisability: true, disabilityType: "청각장애", disabilityGrade: "3급" }, familyInfo: [], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 8),
    makeDoc({ _id: clientIds[16], clientNo: "CL-202603-0017", name: "장미란", birthDate: "1962-05-15", gender: "여", phone: "010-1234-5013", address: "서울시 은평구", registrationDate: isoDate(9), registrationType: "신규", careLevel: "해당없음", incomeLevel: "일반", disabilityInfo: { hasDisability: false }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs1, status: "transferred", changeHistory: [{ date: isoDate(18), type: "전출", note: "경기도 복지관으로 전출" }] }, 9),
    makeDoc({ _id: clientIds[17], clientNo: "CL-202603-0018", name: "권태우", birthDate: "1972-11-25", gender: "남", phone: "010-1234-5014", address: "서울시 도봉구", registrationDate: isoDate(10), registrationType: "신규", careLevel: "해당없음", incomeLevel: "차상위", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "배우자", name: "권지현", contact: "010-1234-5015" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs1, status: "active", changeHistory: [] }, 10),
    makeDoc({ _id: clientIds[18], clientNo: "CL-202603-0019", name: "문지영", birthDate: "1947-01-20", gender: "여", phone: "010-1234-5016", address: "서울시 중랑구", registrationDate: isoDate(11), registrationType: "의뢰", careLevel: "4등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: true, disabilityType: "지체장애", disabilityGrade: "1급" }, familyInfo: [], primaryWorkerSnapshot: worker2Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 11),
    makeDoc({ _id: clientIds[19], clientNo: "CL-202603-0020", name: "신현수", birthDate: "1939-08-29", gender: "남", phone: "010-1234-5017", address: "서울시 양천구", registrationDate: isoDate(12), registrationType: "신규", careLevel: "5등급", incomeLevel: "기초생활", disabilityInfo: { hasDisability: false }, familyInfo: [{ relation: "자녀", name: "신동훈", contact: "010-1234-5018" }], primaryWorkerSnapshot: worker1Actor, facilitySnapshot: fs2, status: "active", changeHistory: [] }, 12),
  ];

  // ── Needs Assessments ──
  const naIds = Array.from({ length: 8 }, () => new ObjectId());
  const needsAssessments = [
    makeDoc({ _id: naIds[0], assessmentNo: "NA-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동", birthDate: "1955-03-15", gender: "남" }, domains: [{ domainName: "건강", score: 3, priority: "높음" }, { domainName: "경제", score: 4, priority: "중간" }, { domainName: "사회관계", score: 2, priority: "높음" }], overallScore: 3.0, facilitySnapshot: fs1, status: "completed" }, 3),
    makeDoc({ _id: naIds[1], assessmentNo: "NA-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희", birthDate: "1948-07-20", gender: "여" }, domains: [{ domainName: "건강", score: 2, priority: "높음" }, { domainName: "일상생활", score: 3, priority: "중간" }], overallScore: 2.5, facilitySnapshot: fs1, status: "completed" }, 4),
    makeDoc({ _id: naIds[2], assessmentNo: "NA-202603-0003", clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신", birthDate: "1942-01-10", gender: "남" }, domains: [{ domainName: "건강", score: 1, priority: "높음" }, { domainName: "경제", score: 2, priority: "높음" }, { domainName: "주거", score: 3, priority: "중간" }], overallScore: 2.0, facilitySnapshot: fs2, status: "completed" }, 5),
    makeDoc({ _id: naIds[3], assessmentNo: "NA-202603-0004", clientSnapshot: { clientId: clientIds[8].toString(), clientNo: "CL-202603-0009", name: "송민지", birthDate: "1965-04-18", gender: "여" }, domains: [{ domainName: "건강", score: 3, priority: "중간" }, { domainName: "경제", score: 2, priority: "높음" }, { domainName: "일상생활", score: 3, priority: "중간" }], overallScore: 2.7, facilitySnapshot: fs1, status: "completed" }, 6),
    makeDoc({ _id: naIds[4], assessmentNo: "NA-202603-0005", clientSnapshot: { clientId: clientIds[10].toString(), clientNo: "CL-202603-0011", name: "윤희정", birthDate: "1940-02-14", gender: "여" }, domains: [{ domainName: "건강", score: 1, priority: "높음" }, { domainName: "일상생활", score: 1, priority: "높음" }, { domainName: "주거", score: 2, priority: "중간" }], overallScore: 1.3, facilitySnapshot: fs2, status: "completed" }, 7),
    makeDoc({ _id: naIds[5], assessmentNo: "NA-202603-0006", clientSnapshot: { clientId: clientIds[13].toString(), clientNo: "CL-202603-0014", name: "임동혁", birthDate: "1958-03-08", gender: "남" }, domains: [{ domainName: "건강", score: 4, priority: "낮음" }, { domainName: "사회관계", score: 2, priority: "높음" }], overallScore: 3.0, facilitySnapshot: fs1, status: "completed" }, 9),
    makeDoc({ _id: naIds[6], assessmentNo: "NA-202603-0007", clientSnapshot: { clientId: clientIds[18].toString(), clientNo: "CL-202603-0019", name: "문지영", birthDate: "1947-01-20", gender: "여" }, domains: [{ domainName: "건강", score: 2, priority: "높음" }, { domainName: "경제", score: 1, priority: "높음" }, { domainName: "사회관계", score: 3, priority: "중간" }], overallScore: 2.0, facilitySnapshot: fs2, status: "in-progress" }, 14),
    makeDoc({ _id: naIds[7], assessmentNo: "NA-202603-0008", clientSnapshot: { clientId: clientIds[19].toString(), clientNo: "CL-202603-0020", name: "신현수", birthDate: "1939-08-29", gender: "남" }, domains: [{ domainName: "건강", score: 1, priority: "높음" }, { domainName: "일상생활", score: 2, priority: "높음" }], overallScore: 1.5, facilitySnapshot: fs2, status: "in-progress" }, 15),
  ];

  // ── Case Plans ──
  const cpIds = Array.from({ length: 5 }, () => new ObjectId());
  const casePlans = [
    makeDoc({ _id: cpIds[0], planNo: "CP-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, assessmentSnapshot: { assessmentId: naIds[0].toString(), assessmentNo: "NA-202603-0001" }, goals: [{ domain: "건강", longTermGoal: "건강상태 유지", shortTermGoals: ["정기 건강검진", "운동 프로그램 참여"], interventions: ["방문간호", "운동교실 연계"] }, { domain: "사회관계", longTermGoal: "사회적 관계망 확대", shortTermGoals: ["프로그램 참여"], interventions: ["노인대학 연계"] }], facilitySnapshot: fs1, status: "in-progress" }, 5),
    makeDoc({ _id: cpIds[1], planNo: "CP-202603-0002", clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신" }, assessmentSnapshot: { assessmentId: naIds[2].toString(), assessmentNo: "NA-202603-0003" }, goals: [{ domain: "건강", longTermGoal: "시각장애 관리", shortTermGoals: ["안과 정기 검진"], interventions: ["의료기관 연계"] }], facilitySnapshot: fs2, status: "approved" }, 7),
    makeDoc({ _id: cpIds[2], planNo: "CP-202603-0003", clientSnapshot: { clientId: clientIds[8].toString(), clientNo: "CL-202603-0009", name: "송민지" }, assessmentSnapshot: { assessmentId: naIds[3].toString(), assessmentNo: "NA-202603-0004" }, goals: [{ domain: "경제", longTermGoal: "경제적 자립 지원", shortTermGoals: ["긴급생활지원 연계", "기초연금 신청"], interventions: ["주민센터 연계", "복지급여 안내"] }], facilitySnapshot: fs1, status: "draft" }, 10),
    makeDoc({ _id: cpIds[3], planNo: "CP-202603-0004", clientSnapshot: { clientId: clientIds[10].toString(), clientNo: "CL-202603-0011", name: "윤희정" }, assessmentSnapshot: { assessmentId: naIds[4].toString(), assessmentNo: "NA-202603-0005" }, goals: [{ domain: "건강", longTermGoal: "뇌병변장애 재활", shortTermGoals: ["물리치료 주 3회", "작업치료 주 2회"], interventions: ["재활병원 연계", "방문재활 서비스"] }, { domain: "일상생활", longTermGoal: "일상생활 자립도 향상", shortTermGoals: ["일상생활훈련 참여"], interventions: ["주간보호센터 연계"] }], facilitySnapshot: fs2, status: "submitted" }, 12),
    makeDoc({ _id: cpIds[4], planNo: "CP-202603-0005", clientSnapshot: { clientId: clientIds[13].toString(), clientNo: "CL-202603-0014", name: "임동혁" }, assessmentSnapshot: { assessmentId: naIds[5].toString(), assessmentNo: "NA-202603-0006" }, goals: [{ domain: "사회관계", longTermGoal: "사회적 고립 해소", shortTermGoals: ["프로그램 참여 주 2회", "자조모임 참여"], interventions: ["실버건강교실 연계", "어울림 프로그램 연계"] }], facilitySnapshot: fs1, status: "completed" }, 14),
  ];

  // ── Service Linkages ──
  const serviceLinkages = [
    makeDoc({ linkageNo: "SL-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, linkageType: "외부", serviceCategory: "의료", referralOrg: "강남구보건소", referralDate: isoDate(6), facilitySnapshot: fs1, status: "active" }, 6),
    makeDoc({ linkageNo: "SL-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희" }, linkageType: "내부", serviceCategory: "재활", referralOrg: "", referralDate: isoDate(7), facilitySnapshot: fs1, status: "active" }, 7),
    makeDoc({ linkageNo: "SL-202603-0003", clientSnapshot: { clientId: clientIds[10].toString(), clientNo: "CL-202603-0011", name: "윤희정" }, linkageType: "외부", serviceCategory: "의료", referralOrg: "서울재활병원", referralDate: isoDate(10), facilitySnapshot: fs2, status: "active" }, 10),
    makeDoc({ linkageNo: "SL-202603-0004", clientSnapshot: { clientId: clientIds[13].toString(), clientNo: "CL-202603-0014", name: "임동혁" }, linkageType: "내부", serviceCategory: "여가", referralOrg: "", referralDate: isoDate(12), facilitySnapshot: fs1, status: "active" }, 12),
    makeDoc({ linkageNo: "SL-202603-0005", clientSnapshot: { clientId: clientIds[18].toString(), clientNo: "CL-202603-0019", name: "문지영" }, linkageType: "외부", serviceCategory: "주거", referralOrg: "중랑구 주거복지센터", referralDate: isoDate(15), facilitySnapshot: fs2, status: "pending" }, 15),
  ];

  // ── Counseling Records ──
  const counselingRecords = [
    makeDoc({ counselingNo: "CR-202603-0001", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, sessionType: "대면", duration: 60, content: "건강 상태 점검 및 프로그램 참여 의향 확인", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 4),
    makeDoc({ counselingNo: "CR-202603-0002", clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희" }, sessionType: "전화", duration: 30, content: "재활 프로그램 안내 및 일정 조율", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ counselingNo: "CR-202603-0003", clientSnapshot: { clientId: clientIds[2].toString(), clientNo: "CL-202603-0003", name: "박철수" }, sessionType: "방문", duration: 90, content: "가정 방문을 통한 생활환경 점검", counselorSnapshot: worker2Actor, facilitySnapshot: fs1, status: "completed" }, 8),
    makeDoc({ counselingNo: "CR-202603-0004", clientSnapshot: { clientId: clientIds[8].toString(), clientNo: "CL-202603-0009", name: "송민지" }, sessionType: "대면", duration: 45, content: "초기상담 및 욕구파악, 경제적 어려움 호소", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 6),
    makeDoc({ counselingNo: "CR-202603-0005", clientSnapshot: { clientId: clientIds[10].toString(), clientNo: "CL-202603-0011", name: "윤희정" }, sessionType: "방문", duration: 120, content: "가정방문 재활상담, ADL 평가 실시", counselorSnapshot: worker1Actor, facilitySnapshot: fs2, status: "completed" }, 9),
    makeDoc({ counselingNo: "CR-202603-0006", clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신" }, sessionType: "전화", duration: 20, content: "안과 검진 일정 확인 및 교통편 안내", counselorSnapshot: worker1Actor, facilitySnapshot: fs2, status: "completed" }, 11),
    makeDoc({ counselingNo: "CR-202603-0007", clientSnapshot: { clientId: clientIds[13].toString(), clientNo: "CL-202603-0014", name: "임동혁" }, sessionType: "대면", duration: 50, content: "사회적 고립감 상담, 프로그램 참여 독려", counselorSnapshot: worker2Actor, facilitySnapshot: fs1, status: "completed" }, 13),
    makeDoc({ counselingNo: "CR-202603-0008", clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, sessionType: "온라인", duration: 30, content: "건강상태 모니터링 및 운동 프로그램 참여 독려", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 16),
    makeDoc({ counselingNo: "CR-202603-0009", clientSnapshot: { clientId: clientIds[18].toString(), clientNo: "CL-202603-0019", name: "문지영" }, sessionType: "방문", duration: 90, content: "주거환경 점검 및 재가서비스 연계 상담", counselorSnapshot: worker2Actor, facilitySnapshot: fs2, status: "completed" }, 18),
    makeDoc({ counselingNo: "CR-202603-0010", clientSnapshot: { clientId: clientIds[17].toString(), clientNo: "CL-202603-0018", name: "권태우" }, sessionType: "전화", duration: 25, content: "프로그램 참여 안내 및 욕구 조사", counselorSnapshot: worker1Actor, facilitySnapshot: fs1, status: "completed" }, 20),
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

  // ── Program Participants ──
  const programParticipants = [
    // 실버건강교실 participants (8)
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[0].toString(), clientNo: "CL-202603-0001", name: "홍길동" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: true }], attendanceRate: 100, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[1].toString(), clientNo: "CL-202603-0002", name: "김영희" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: false }], attendanceRate: 50, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[5].toString(), clientNo: "CL-202603-0006", name: "강감찬" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: true }], attendanceRate: 100, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[8].toString(), clientNo: "CL-202603-0009", name: "송민지" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: true }], attendanceRate: 100, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[13].toString(), clientNo: "CL-202603-0014", name: "임동혁" }, attendanceRecords: [{ sessionNumber: 1, attended: false }, { sessionNumber: 2, attended: true }], attendanceRate: 50, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[15].toString(), clientNo: "CL-202603-0016", name: "서재원" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: true }], attendanceRate: 100, facilitySnapshot: fs1, status: "active" }, 8),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[17].toString(), clientNo: "CL-202603-0018", name: "권태우" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: false }], attendanceRate: 50, facilitySnapshot: fs1, status: "active" }, 10),
    makeDoc({ programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, clientSnapshot: { clientId: clientIds[4].toString(), clientNo: "CL-202603-0005", name: "정미숙" }, attendanceRecords: [{ sessionNumber: 1, attended: true }, { sessionNumber: 2, attended: true }], attendanceRate: 100, facilitySnapshot: fs1, status: "active" }, 5),
    // 아동방과후교실 participants (4)
    makeDoc({ programSnapshot: { programId: programIds[1].toString(), programNo: "PGM-202603-0002", name: "아동방과후교실" }, clientSnapshot: { clientId: clientIds[2].toString(), clientNo: "CL-202603-0003", name: "박철수" }, attendanceRecords: [], attendanceRate: 0, facilitySnapshot: fs1, status: "registered" }, 4),
    makeDoc({ programSnapshot: { programId: programIds[1].toString(), programNo: "PGM-202603-0002", name: "아동방과후교실" }, clientSnapshot: { clientId: clientIds[4].toString(), clientNo: "CL-202603-0005", name: "정미숙" }, attendanceRecords: [], attendanceRate: 0, facilitySnapshot: fs1, status: "registered" }, 4),
    makeDoc({ programSnapshot: { programId: programIds[1].toString(), programNo: "PGM-202603-0002", name: "아동방과후교실" }, clientSnapshot: { clientId: clientIds[6].toString(), clientNo: "CL-202603-0007", name: "유관순" }, attendanceRecords: [], attendanceRate: 0, facilitySnapshot: fs1, status: "registered" }, 5),
    makeDoc({ programSnapshot: { programId: programIds[1].toString(), programNo: "PGM-202603-0002", name: "아동방과후교실" }, clientSnapshot: { clientId: clientIds[12].toString(), clientNo: "CL-202603-0013", name: "배수진" }, attendanceRecords: [], attendanceRate: 0, facilitySnapshot: fs1, status: "registered" }, 5),
    // 치매예방프로그램 participants (3)
    makeDoc({ programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, clientSnapshot: { clientId: clientIds[3].toString(), clientNo: "CL-202603-0004", name: "이순신" }, attendanceRecords: [{ sessionNumber: 1, attended: true }], attendanceRate: 100, facilitySnapshot: fs2, status: "active" }, 7),
    makeDoc({ programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, clientSnapshot: { clientId: clientIds[9].toString(), clientNo: "CL-202603-0010", name: "조영수" }, attendanceRecords: [{ sessionNumber: 1, attended: true }], attendanceRate: 100, facilitySnapshot: fs2, status: "active" }, 7),
    makeDoc({ programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, clientSnapshot: { clientId: clientIds[19].toString(), clientNo: "CL-202603-0020", name: "신현수" }, attendanceRecords: [{ sessionNumber: 1, attended: false }], attendanceRate: 0, facilitySnapshot: fs2, status: "active" }, 7),
  ];

  // ── Satisfaction Surveys ──
  const satisfactionSurveys = [
    makeDoc({ surveyNo: "SAT-202603-0001", programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, surveyPeriod: "2026-03 중간평가", questions: [{ questionNo: 1, question: "프로그램 내용에 만족하십니까?", avgScore: 4.5 }, { questionNo: 2, question: "강사의 진행이 적절했습니까?", avgScore: 4.7 }, { questionNo: 3, question: "시설과 환경은 적절했습니까?", avgScore: 4.2 }, { questionNo: 4, question: "프로그램 시간이 적절했습니까?", avgScore: 3.8 }, { questionNo: 5, question: "타인에게 추천하시겠습니까?", avgScore: 4.6 }], overallScore: 4.36, respondentCount: 8, facilitySnapshot: fs1, status: "completed" }, 18),
    makeDoc({ surveyNo: "SAT-202603-0002", programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, surveyPeriod: "2026-03 중간평가", questions: [{ questionNo: 1, question: "프로그램 내용에 만족하십니까?", avgScore: 4.0 }, { questionNo: 2, question: "인지훈련 활동이 도움이 되었습니까?", avgScore: 4.3 }, { questionNo: 3, question: "프로그램 진행 속도가 적절했습니까?", avgScore: 3.5 }, { questionNo: 4, question: "참여 환경이 편안했습니까?", avgScore: 4.1 }, { questionNo: 5, question: "지속적으로 참여하고 싶습니까?", avgScore: 4.4 }], overallScore: 4.06, respondentCount: 3, facilitySnapshot: fs2, status: "completed" }, 18),
    makeDoc({ surveyNo: "SAT-202603-0003", programSnapshot: { programId: programIds[1].toString(), programNo: "PGM-202603-0002", name: "아동방과후교실" }, surveyPeriod: "2026-03 사전조사", questions: [{ questionNo: 1, question: "프로그램에 대한 기대 수준은?", avgScore: 4.2 }, { questionNo: 2, question: "프로그램 일정이 편리합니까?", avgScore: 3.9 }, { questionNo: 3, question: "학습지도에 대한 기대는?", avgScore: 4.5 }], overallScore: 4.2, respondentCount: 4, facilitySnapshot: fs1, status: "completed" }, 10),
  ];

  // ── Performance Evaluations ──
  const performanceEvaluations = [
    makeDoc({ evaluationNo: "PE-202603-0001", programSnapshot: { programId: programIds[0].toString(), programNo: "PGM-202603-0001", name: "실버건강교실" }, evaluationPeriod: "2026-03 중간평가", evaluatorSnapshot: worker1Actor, metrics: [{ metricName: "참여율", target: 80, actual: 87.5, unit: "%" }, { metricName: "만족도", target: 4.0, actual: 4.36, unit: "점" }, { metricName: "건강지표 개선율", target: 60, actual: 55, unit: "%" }], overallRating: "양호", recommendations: "참여율 및 만족도 목표 달성. 건강지표 개선을 위해 개별 운동 처방 강화 필요.", facilitySnapshot: fs1, status: "completed" }, 20),
    makeDoc({ evaluationNo: "PE-202603-0002", programSnapshot: { programId: programIds[2].toString(), programNo: "PGM-202603-0003", name: "치매예방프로그램" }, evaluationPeriod: "2026-03 중간평가", evaluatorSnapshot: worker1Actor, metrics: [{ metricName: "참여율", target: 80, actual: 66.7, unit: "%" }, { metricName: "만족도", target: 4.0, actual: 4.06, unit: "점" }, { metricName: "인지기능 유지율", target: 70, actual: 75, unit: "%" }], overallRating: "보통", recommendations: "참여율이 목표 미달. 참여 독려 및 교통 지원 방안 검토 필요.", facilitySnapshot: fs2, status: "completed" }, 20),
  ];

  // ── Donors ──
  const donorIds = Array.from({ length: 5 }, () => new ObjectId());
  const donors = [
    makeDoc({ _id: donorIds[0], donorNo: "DNR-202603-0001", donorType: "individual", name: "김후원", taxIdNo: "", donorCategory: "정기", facilitySnapshot: fs1, status: "active" }, 1),
    makeDoc({ _id: donorIds[1], donorNo: "DNR-202603-0002", donorType: "corporate", name: "(주)사랑나눔", taxIdNo: "123-45-67890", donorCategory: "비정기", facilitySnapshot: fs1, status: "active" }, 2),
    makeDoc({ _id: donorIds[2], donorNo: "DNR-202603-0003", donorType: "individual", name: "박자선", taxIdNo: "", donorCategory: "정기", facilitySnapshot: fs1, status: "active" }, 3),
    makeDoc({ _id: donorIds[3], donorNo: "DNR-202603-0004", donorType: "corporate", name: "서울복지재단", taxIdNo: "234-56-78901", donorCategory: "정기", facilitySnapshot: fs1, status: "active" }, 4),
    makeDoc({ _id: donorIds[4], donorNo: "DNR-202603-0005", donorType: "religious", name: "이웃사랑교회", taxIdNo: "", donorCategory: "비정기", facilitySnapshot: fs2, status: "active" }, 5),
  ];

  // ── Donations ──
  const donations = [
    makeDoc({ donationNo: "DON-202603-0001", donorSnapshot: { donorId: donorIds[0].toString(), donorNo: "DNR-202603-0001", name: "김후원" }, donationType: "현금", amount: 100000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ donationNo: "DON-202603-0002", donorSnapshot: { donorId: donorIds[0].toString(), donorNo: "DNR-202603-0001", name: "김후원" }, donationType: "현금", amount: 100000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 10),
    makeDoc({ donationNo: "DON-202603-0003", donorSnapshot: { donorId: donorIds[1].toString(), donorNo: "DNR-202603-0002", name: "(주)사랑나눔" }, donationType: "현금", amount: 5000000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 15),
    makeDoc({ donationNo: "DON-202603-0004", donorSnapshot: { donorId: donorIds[2].toString(), donorNo: "DNR-202603-0003", name: "박자선" }, donationType: "현금", amount: 50000, paymentMethod: "자동이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 5),
    makeDoc({ donationNo: "DON-202603-0005", donorSnapshot: { donorId: donorIds[2].toString(), donorNo: "DNR-202603-0003", name: "박자선" }, donationType: "현금", amount: 50000, paymentMethod: "자동이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 10),
    makeDoc({ donationNo: "DON-202603-0006", donorSnapshot: { donorId: donorIds[2].toString(), donorNo: "DNR-202603-0003", name: "박자선" }, donationType: "현금", amount: 50000, paymentMethod: "자동이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 15),
    makeDoc({ donationNo: "DON-202603-0007", donorSnapshot: { donorId: donorIds[3].toString(), donorNo: "DNR-202603-0004", name: "서울복지재단" }, donationType: "현금", amount: 10000000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 8),
    makeDoc({ donationNo: "DON-202603-0008", donorSnapshot: { donorId: donorIds[4].toString(), donorNo: "DNR-202603-0005", name: "이웃사랑교회" }, donationType: "현금", amount: 3000000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs2, status: "completed" }, 12),
    makeDoc({ donationNo: "DON-202603-0009", donorSnapshot: { donorId: donorIds[0].toString(), donorNo: "DNR-202603-0001", name: "김후원" }, donationType: "현금", amount: 100000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "completed" }, 20),
    makeDoc({ donationNo: "DON-202603-0010", donorSnapshot: { donorId: donorIds[3].toString(), donorNo: "DNR-202603-0004", name: "서울복지재단" }, donationType: "현금", amount: 20000000, paymentMethod: "계좌이체", receiptIssued: true, facilitySnapshot: fs1, status: "pending" }, 24),
  ];

  // ── In-Kind Donations ──
  const inKindDonations = [
    makeDoc({ donationNo: "IKD-202603-0001", donorSnapshot: { donorId: donorIds[1].toString(), donorNo: "DNR-202603-0002", name: "(주)사랑나눔" }, itemName: "쌀 20kg", quantity: 50, estimatedValue: 2500000, distributedTo: "이용자 가정", facilitySnapshot: fs1, status: "distributed" }, 7),
    makeDoc({ donationNo: "IKD-202603-0002", donorSnapshot: { donorId: donorIds[4].toString(), donorNo: "DNR-202603-0005", name: "이웃사랑교회" }, itemName: "라면 박스", quantity: 30, estimatedValue: 450000, distributedTo: "긴급지원 대상자", facilitySnapshot: fs2, status: "distributed" }, 14),
    makeDoc({ donationNo: "IKD-202603-0003", donorSnapshot: { donorId: donorIds[1].toString(), donorNo: "DNR-202603-0002", name: "(주)사랑나눔" }, itemName: "생필품 세트", quantity: 20, estimatedValue: 1000000, distributedTo: "저소득 어르신", facilitySnapshot: fs1, status: "received" }, 20),
  ];

  // ── Volunteers ──
  const volunteerIds = Array.from({ length: 5 }, () => new ObjectId());
  const volunteers = [
    makeDoc({ _id: volunteerIds[0], volunteerNo: "VOL-202603-0001", name: "한봉사", phone: "010-1234-0001", skills: ["요리", "운전"], availableDays: ["월", "수", "금"], orientation1365Id: "1365-001", totalHours: 48, facilitySnapshot: fs1, status: "active" }, 1),
    makeDoc({ _id: volunteerIds[1], volunteerNo: "VOL-202603-0002", name: "오도움", phone: "010-1234-0002", skills: ["교육", "상담"], availableDays: ["화", "목"], orientation1365Id: "1365-002", totalHours: 24, facilitySnapshot: fs1, status: "active" }, 2),
    makeDoc({ _id: volunteerIds[2], volunteerNo: "VOL-202603-0003", name: "정나눔", phone: "010-1234-0003", skills: ["간호보조", "말벗"], availableDays: ["월", "화", "수", "목", "금"], orientation1365Id: "1365-003", totalHours: 60, facilitySnapshot: fs2, status: "active" }, 3),
    makeDoc({ _id: volunteerIds[3], volunteerNo: "VOL-202603-0004", name: "김열정", phone: "010-1234-0004", skills: ["미술", "공예"], availableDays: ["수", "토"], orientation1365Id: "1365-004", totalHours: 16, facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ _id: volunteerIds[4], volunteerNo: "VOL-202603-0005", name: "박헌신", phone: "010-1234-0005", skills: ["운전", "사무보조"], availableDays: ["월", "수", "금"], orientation1365Id: "1365-005", totalHours: 32, facilitySnapshot: fs1, status: "active" }, 6),
  ];

  // ── Volunteer Activities ──
  const volunteerActivities = [
    makeDoc({ activityNo: "VA-202603-0001", title: "급식봉사", category: "배식", assignedVolunteers: [volunteerIds[0].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(6), facilitySnapshot: fs1, status: "completed" }, 6),
    makeDoc({ activityNo: "VA-202603-0002", title: "학습지도", category: "교육", assignedVolunteers: [volunteerIds[1].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(8), facilitySnapshot: fs1, status: "completed" }, 8),
    makeDoc({ activityNo: "VA-202603-0003", title: "말벗봉사", category: "정서지원", assignedVolunteers: [volunteerIds[2].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(10), facilitySnapshot: fs2, status: "completed" }, 10),
    makeDoc({ activityNo: "VA-202603-0004", title: "환경미화", category: "시설관리", assignedVolunteers: [volunteerIds[0].toString(), volunteerIds[4].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(15), facilitySnapshot: fs1, status: "completed" }, 15),
    makeDoc({ activityNo: "VA-202603-0005", title: "공예교실 보조", category: "프로그램보조", assignedVolunteers: [volunteerIds[3].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(18), facilitySnapshot: fs1, status: "completed" }, 18),
    makeDoc({ activityNo: "VA-202603-0006", title: "이용자 송영", category: "이동지원", assignedVolunteers: [volunteerIds[4].toString()], supervisorSnapshot: worker2Actor, activityDate: isoDate(22), facilitySnapshot: fs1, status: "completed" }, 22),
  ];

  // ── Volunteer Hours ──
  const volunteerHours = [
    makeDoc({ hoursNo: "VH-202603-0001", volunteerSnapshot: { volunteerId: volunteerIds[0].toString(), volunteerNo: "VOL-202603-0001", name: "한봉사" }, activitySnapshot: { activityNo: "VA-202603-0001", title: "급식봉사" }, hours: 4, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 6),
    makeDoc({ hoursNo: "VH-202603-0002", volunteerSnapshot: { volunteerId: volunteerIds[1].toString(), volunteerNo: "VOL-202603-0002", name: "오도움" }, activitySnapshot: { activityNo: "VA-202603-0002", title: "학습지도" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 8),
    makeDoc({ hoursNo: "VH-202603-0003", volunteerSnapshot: { volunteerId: volunteerIds[2].toString(), volunteerNo: "VOL-202603-0003", name: "정나눔" }, activitySnapshot: { activityNo: "VA-202603-0003", title: "말벗봉사" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs2, status: "verified" }, 10),
    makeDoc({ hoursNo: "VH-202603-0004", volunteerSnapshot: { volunteerId: volunteerIds[0].toString(), volunteerNo: "VOL-202603-0001", name: "한봉사" }, activitySnapshot: { activityNo: "VA-202603-0004", title: "환경미화" }, hours: 4, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 15),
    makeDoc({ hoursNo: "VH-202603-0005", volunteerSnapshot: { volunteerId: volunteerIds[4].toString(), volunteerNo: "VOL-202603-0005", name: "박헌신" }, activitySnapshot: { activityNo: "VA-202603-0004", title: "환경미화" }, hours: 4, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 15),
    makeDoc({ hoursNo: "VH-202603-0006", volunteerSnapshot: { volunteerId: volunteerIds[3].toString(), volunteerNo: "VOL-202603-0004", name: "김열정" }, activitySnapshot: { activityNo: "VA-202603-0005", title: "공예교실 보조" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 18),
    makeDoc({ hoursNo: "VH-202603-0007", volunteerSnapshot: { volunteerId: volunteerIds[4].toString(), volunteerNo: "VOL-202603-0005", name: "박헌신" }, activitySnapshot: { activityNo: "VA-202603-0006", title: "이용자 송영" }, hours: 2, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 22),
    makeDoc({ hoursNo: "VH-202603-0008", volunteerSnapshot: { volunteerId: volunteerIds[2].toString(), volunteerNo: "VOL-202603-0003", name: "정나눔" }, activitySnapshot: { activityNo: "VA-202603-0003", title: "말벗봉사" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs2, status: "pending" }, 22),
    makeDoc({ hoursNo: "VH-202603-0009", volunteerSnapshot: { volunteerId: volunteerIds[0].toString(), volunteerNo: "VOL-202603-0001", name: "한봉사" }, activitySnapshot: { activityNo: "VA-202603-0001", title: "급식봉사" }, hours: 4, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 20),
    makeDoc({ hoursNo: "VH-202603-0010", volunteerSnapshot: { volunteerId: volunteerIds[1].toString(), volunteerNo: "VOL-202603-0002", name: "오도움" }, activitySnapshot: { activityNo: "VA-202603-0002", title: "학습지도" }, hours: 3, verifiedBy: worker2Actor, facilitySnapshot: fs1, status: "verified" }, 22),
  ];

  // ── Staff ──
  const staffIds = Array.from({ length: 8 }, () => new ObjectId());
  const staffDocs = [
    makeDoc({ _id: staffIds[0], staffNo: "STF-202603-0001", name: "이사복", position: "사회복지사", department: "사례관리팀", contractType: "정규직", qualifications: ["사회복지사 1급"], trainings: [{ name: "사례관리 실무교육", completedDate: "2026-01-15" }], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[1], staffNo: "STF-202603-0002", name: "최봉사", position: "사회복지사", department: "자원봉사팀", contractType: "정규직", qualifications: ["사회복지사 2급"], trainings: [], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[2], staffNo: "STF-202603-0003", name: "김간호", position: "간호사", department: "건강관리팀", contractType: "계약직", qualifications: ["간호사 면허"], trainings: [{ name: "치매관리 교육", completedDate: "2026-02-10" }], facilitySnapshot: fs2, status: "active" }, 0),
    makeDoc({ _id: staffIds[3], staffNo: "STF-202603-0004", name: "정영양", position: "영양사", department: "급식팀", contractType: "정규직", qualifications: ["영양사 면허"], trainings: [{ name: "노인 영양관리 교육", completedDate: "2026-02-20" }], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[4], staffNo: "STF-202603-0005", name: "한재활", position: "물리치료사", department: "건강관리팀", contractType: "정규직", qualifications: ["물리치료사 면허"], trainings: [{ name: "노인 재활치료 과정", completedDate: "2025-12-20" }], facilitySnapshot: fs2, status: "active" }, 0),
    makeDoc({ _id: staffIds[5], staffNo: "STF-202603-0006", name: "오운전", position: "운전기사", department: "총무팀", contractType: "정규직", qualifications: ["1종 대형면허"], trainings: [{ name: "교통안전 교육", completedDate: "2026-01-10" }], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[6], staffNo: "STF-202603-0007", name: "윤사무", position: "사무원", department: "총무팀", contractType: "계약직", qualifications: ["컴퓨터활용능력 1급"], trainings: [], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ _id: staffIds[7], staffNo: "STF-202603-0008", name: "강코디", position: "프로그램 코디네이터", department: "사업팀", contractType: "정규직", qualifications: ["사회복지사 2급", "레크리에이션 지도사"], trainings: [{ name: "프로그램 기획 워크숍", completedDate: "2026-02-15" }], facilitySnapshot: fs1, status: "active" }, 0),
  ];

  // ── HR Attendance ──
  const hrAttendance = [
    // Day 10
    makeDoc({ attendanceNo: "ATT-202603-0001", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, date: isoDate(10), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0002", staffSnapshot: { staffId: staffIds[1].toString(), staffNo: "STF-202603-0002", name: "최봉사" }, date: isoDate(10), scheduleType: "주간", checkInTime: "09:15", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "late" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0003", staffSnapshot: { staffId: staffIds[2].toString(), staffNo: "STF-202603-0003", name: "김간호" }, date: isoDate(10), scheduleType: "주간", checkInTime: null, checkOutTime: null, leaveType: "연차", facilitySnapshot: fs2, status: "leave" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0004", staffSnapshot: { staffId: staffIds[3].toString(), staffNo: "STF-202603-0004", name: "정영양" }, date: isoDate(10), scheduleType: "주간", checkInTime: "08:30", checkOutTime: "17:30", leaveType: null, facilitySnapshot: fs1, status: "present" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0005", staffSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, date: isoDate(10), scheduleType: "주간", checkInTime: "08:00", checkOutTime: "17:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 10),
    makeDoc({ attendanceNo: "ATT-202603-0006", staffSnapshot: { staffId: staffIds[7].toString(), staffNo: "STF-202603-0008", name: "강코디" }, date: isoDate(10), scheduleType: "주간", checkInTime: "09:05", checkOutTime: "18:30", leaveType: null, facilitySnapshot: fs1, status: "present" }, 10),
    // Day 11
    makeDoc({ attendanceNo: "ATT-202603-0007", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, date: isoDate(11), scheduleType: "주간", checkInTime: "08:55", checkOutTime: "18:10", leaveType: null, facilitySnapshot: fs1, status: "present" }, 11),
    makeDoc({ attendanceNo: "ATT-202603-0008", staffSnapshot: { staffId: staffIds[1].toString(), staffNo: "STF-202603-0002", name: "최봉사" }, date: isoDate(11), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 11),
    makeDoc({ attendanceNo: "ATT-202603-0009", staffSnapshot: { staffId: staffIds[2].toString(), staffNo: "STF-202603-0003", name: "김간호" }, date: isoDate(11), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs2, status: "present" }, 11),
    makeDoc({ attendanceNo: "ATT-202603-0010", staffSnapshot: { staffId: staffIds[4].toString(), staffNo: "STF-202603-0005", name: "한재활" }, date: isoDate(11), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs2, status: "present" }, 11),
    makeDoc({ attendanceNo: "ATT-202603-0011", staffSnapshot: { staffId: staffIds[6].toString(), staffNo: "STF-202603-0007", name: "윤사무" }, date: isoDate(11), scheduleType: "주간", checkInTime: "09:00", checkOutTime: "18:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 11),
    // Day 12
    makeDoc({ attendanceNo: "ATT-202603-0012", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, date: isoDate(12), scheduleType: "주간", checkInTime: null, checkOutTime: null, leaveType: "출장", facilitySnapshot: fs1, status: "business-trip" }, 12),
    makeDoc({ attendanceNo: "ATT-202603-0013", staffSnapshot: { staffId: staffIds[3].toString(), staffNo: "STF-202603-0004", name: "정영양" }, date: isoDate(12), scheduleType: "주간", checkInTime: "08:30", checkOutTime: "17:30", leaveType: null, facilitySnapshot: fs1, status: "present" }, 12),
    makeDoc({ attendanceNo: "ATT-202603-0014", staffSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, date: isoDate(12), scheduleType: "주간", checkInTime: "07:50", checkOutTime: "17:00", leaveType: null, facilitySnapshot: fs1, status: "present" }, 12),
    // Day 24 (today)
    makeDoc({ attendanceNo: "ATT-202603-0015", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, date: isoDate(24), scheduleType: "주간", checkInTime: "09:00", checkOutTime: null, leaveType: null, facilitySnapshot: fs1, status: "present" }, 24),
    makeDoc({ attendanceNo: "ATT-202603-0016", staffSnapshot: { staffId: staffIds[1].toString(), staffNo: "STF-202603-0002", name: "최봉사" }, date: isoDate(24), scheduleType: "주간", checkInTime: "08:50", checkOutTime: null, leaveType: null, facilitySnapshot: fs1, status: "present" }, 24),
    makeDoc({ attendanceNo: "ATT-202603-0017", staffSnapshot: { staffId: staffIds[7].toString(), staffNo: "STF-202603-0008", name: "강코디" }, date: isoDate(24), scheduleType: "주간", checkInTime: "09:10", checkOutTime: null, leaveType: null, facilitySnapshot: fs1, status: "present" }, 24),
    makeDoc({ attendanceNo: "ATT-202603-0018", staffSnapshot: { staffId: staffIds[4].toString(), staffNo: "STF-202603-0005", name: "한재활" }, date: isoDate(24), scheduleType: "주간", checkInTime: null, checkOutTime: null, leaveType: "반차(오전)", facilitySnapshot: fs2, status: "half-leave" }, 24),
  ];

  // ── Facility Rooms ──
  const facilityRooms = [
    makeDoc({ roomNo: "RM-202603-0001", name: "다목적실", floor: "1층", roomType: "프로그램실", capacity: 30, equipment: ["빔프로젝터", "음향장비"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0002", name: "상담실 A", floor: "2층", roomType: "상담실", capacity: 4, equipment: ["테이블", "의자"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0003", name: "요양실 101", floor: "1층", roomType: "요양실", capacity: 4, equipment: ["의료침대", "커튼"], facilitySnapshot: fs2, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0004", name: "요리실", floor: "지하1층", roomType: "실습실", capacity: 15, equipment: ["조리대", "가스레인지", "냉장고", "식기"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0005", name: "체육관", floor: "지하1층", roomType: "운동실", capacity: 40, equipment: ["매트", "운동기구", "거울", "음향장비"], facilitySnapshot: fs1, status: "active" }, 0),
    makeDoc({ roomNo: "RM-202603-0006", name: "사무실", floor: "3층", roomType: "사무공간", capacity: 10, equipment: ["데스크", "복합기", "캐비닛"], facilitySnapshot: fs1, status: "active" }, 0),
  ];

  // ── Facility Supplies ──
  const facilitySupplies = [
    makeDoc({ supplyNo: "SUP-202603-0001", itemName: "A4 용지", category: "사무용품", currentStock: 50, minimumStock: 10, unitPrice: 5000, facilitySnapshot: fs1, status: "adequate" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0002", itemName: "손소독제", category: "위생용품", currentStock: 3, minimumStock: 5, unitPrice: 8000, facilitySnapshot: fs1, status: "low-stock" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0003", itemName: "일회용 장갑", category: "위생용품", currentStock: 200, minimumStock: 50, unitPrice: 15000, facilitySnapshot: fs2, status: "adequate" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0004", itemName: "토너 카트리지", category: "사무용품", currentStock: 2, minimumStock: 3, unitPrice: 45000, facilitySnapshot: fs1, status: "low-stock" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0005", itemName: "기저귀(성인)", category: "요양용품", currentStock: 100, minimumStock: 30, unitPrice: 25000, facilitySnapshot: fs2, status: "adequate" }, 0),
    makeDoc({ supplyNo: "SUP-202603-0006", itemName: "물티슈", category: "위생용품", currentStock: 80, minimumStock: 20, unitPrice: 3000, facilitySnapshot: fs2, status: "adequate" }, 0),
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
    makeDoc({ documentNo: "APD-202603-0003", title: "사례종결보고서 - 안중근", documentType: "사례종결보고서", content: "안중근 이용자 사례 종결에 대한 보고서입니다. 타 지역 전출로 인한 사례 종결.", drafterId: userWorker1Id.toString(), drafterSnapshot: worker1Actor, approvalLine: [{ step: 1, role: "담당자", approverId: userWorker1Id.toString(), approverName: "이사복", status: "approved", decidedAt: isoTimestamp(10) }, { step: 2, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "approved", decidedAt: isoTimestamp(10, 14) }, { step: 3, role: "센터장", approverId: userAdminId.toString(), approverName: "김관리", status: "approved", decidedAt: isoTimestamp(11) }], currentStep: 3, facilitySnapshot: fs2, overallStatus: "final-approved" }, 9),
    makeDoc({ documentNo: "APD-202603-0004", title: "실버건강교실 프로그램 계획서", documentType: "프로그램 계획서", content: "2026년 실버건강교실 프로그램 운영 계획서", drafterId: userWorker2Id.toString(), drafterSnapshot: worker2Actor, approvalLine: [{ step: 1, role: "담당자", approverId: userWorker2Id.toString(), approverName: "최봉사", status: "approved", decidedAt: isoTimestamp(2) }, { step: 2, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "approved", decidedAt: isoTimestamp(3) }], currentStep: 2, facilitySnapshot: fs1, overallStatus: "final-approved" }, 1),
    makeDoc({ documentNo: "APD-202603-0005", title: "3월 사무용품 구입 지출결의서", documentType: "지출결의서", content: "A4용지 20박스, 토너 3개, 사무용품 외 구입", drafterId: userWorker1Id.toString(), drafterSnapshot: worker1Actor, approvalLine: [{ step: 1, role: "담당자", approverId: userWorker1Id.toString(), approverName: "이사복", status: "approved", decidedAt: isoTimestamp(18) }, { step: 2, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "rejected", decidedAt: isoTimestamp(19), rejectReason: "예산 초과. 수량 조정 후 재결재 바랍니다." }], currentStep: 2, facilitySnapshot: fs1, overallStatus: "rejected" }, 17),
    makeDoc({ documentNo: "APD-202603-0006", title: "연차휴가 신청서 - 이사복", documentType: "휴가신청서", content: "3월 28일(금) 연차 사용 신청합니다.", drafterId: userWorker1Id.toString(), drafterSnapshot: worker1Actor, approvalLine: [{ step: 1, role: "팀장", approverId: userLeadId.toString(), approverName: "박시설", status: "pending", decidedAt: null }], currentStep: 1, facilitySnapshot: fs1, overallStatus: "draft" }, 23),
  ];

  // ── Circulation Posts ──
  const circulationPosts = [
    makeDoc({ circulationNo: "CRC-202603-0001", title: "3월 직원 교육 안내", content: "3월 25일 오후 2시 직원 교육이 진행됩니다.", authorSnapshot: adminActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(9) }], unviewedCount: 2, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 8),
    makeDoc({ circulationNo: "CRC-202603-0002", title: "시설 안전점검 결과", content: "2월 안전점검 결과를 공람합니다.", authorSnapshot: leadActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userAdminId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(11) }, { userId: userAdminId.toString(), viewedAt: isoTimestamp(11) }], unviewedCount: 1, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 10),
    makeDoc({ circulationNo: "CRC-202603-0003", title: "2월 후원금 수입 현황", content: "2월 후원금 수입 및 사용 현황을 공람합니다. 총 수입: 18,350,000원", authorSnapshot: adminActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString(), userExecId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(6) }, { userId: userLeadId.toString(), viewedAt: isoTimestamp(6) }, { userId: userWorker2Id.toString(), viewedAt: isoTimestamp(7) }, { userId: userExecId.toString(), viewedAt: isoTimestamp(8) }], unviewedCount: 0, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 5),
    makeDoc({ circulationNo: "CRC-202603-0004", title: "4월 프로그램 일정 안내", content: "4월 프로그램 운영 일정을 공람합니다.", authorSnapshot: worker2Actor, targetViewers: [userWorker1Id.toString(), userLeadId.toString(), userAdminId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(22) }], unviewedCount: 2, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 21),
    makeDoc({ circulationNo: "CRC-202603-0005", title: "코로나19 방역 지침 변경사항", content: "보건복지부 방역 지침 변경에 따른 시설 운영 안내", authorSnapshot: leadActor, targetViewers: [userWorker1Id.toString(), userWorker2Id.toString(), userAdminId.toString()], viewedBy: [{ userId: userWorker1Id.toString(), viewedAt: isoTimestamp(16) }, { userId: userAdminId.toString(), viewedAt: isoTimestamp(16) }, { userId: userWorker2Id.toString(), viewedAt: isoTimestamp(17) }], unviewedCount: 0, month: "2026-03", facilitySnapshot: fs1, status: "active" }, 15),
  ];

  // ── Schedules ──
  const schedules = [
    // Today (day 24 = March 25)
    makeDoc({ scheduleNo: "SCH-202603-0001", title: "아침 조례", date: isoDate(24), startTime: "09:00", endTime: "10:00", location: "다목적실", category: "회의", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString(), userAdminId.toString()], memo: "일일 업무 공유 및 공지사항 전달", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0002", title: "사례회의", date: isoDate(24), startTime: "10:00", endTime: "12:00", location: "다목적실", category: "회의", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], memo: "3월 정기 사례회의 - 신규 사례 3건, 종결 1건 논의", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0003", title: "실버건강교실 3회차", date: isoDate(24), startTime: "13:30", endTime: "15:00", location: "체육관", category: "프로그램", participants: [userWorker2Id.toString()], memo: "근력강화 운동", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0004", title: "봉사자 간담회", date: isoDate(24), startTime: "15:00", endTime: "16:00", location: "상담실 A", category: "회의", participants: [userWorker2Id.toString()], memo: "3월 봉사활동 피드백 및 4월 계획 논의", facilitySnapshot: fs1, status: "scheduled" }, 20),
    makeDoc({ scheduleNo: "SCH-202603-0005", title: "주간 실적 보고", date: isoDate(24), startTime: "16:30", endTime: "17:30", location: "사무실", category: "보고", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], memo: "3월 4주차 실적 정리 및 보고", facilitySnapshot: fs1, status: "scheduled" }, 20),
    // Past schedules
    makeDoc({ scheduleNo: "SCH-202603-0006", title: "사례회의", date: isoDate(10), startTime: "10:00", endTime: "12:00", location: "다목적실", category: "회의", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString()], memo: "3월 2주차 사례회의", facilitySnapshot: fs1, status: "completed" }, 8),
    makeDoc({ scheduleNo: "SCH-202603-0007", title: "서울시 사회복지 협의회", date: isoDate(17), startTime: "14:00", endTime: "16:00", location: "서울시청", category: "외부출장", participants: [userLeadId.toString()], memo: "분기별 협의회 참석", facilitySnapshot: fs1, status: "completed" }, 14),
    makeDoc({ scheduleNo: "SCH-202603-0008", title: "직원 교육", date: isoDate(20), startTime: "14:00", endTime: "17:00", location: "다목적실", category: "교육", participants: [userWorker1Id.toString(), userWorker2Id.toString(), userLeadId.toString(), userAdminId.toString()], memo: "사회복지 윤리 교육", facilitySnapshot: fs1, status: "completed" }, 18),
  ];

  // ── Work Logs ──
  const workLogs = [
    makeDoc({ workLogNo: "WL-202603-0001", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, weekStartDate: isoDate(10), weekEndDate: isoDate(14), dailyEntries: [{ date: isoDate(10), tasks: ["사례회의 준비", "홍길동 상담"], notes: "" }, { date: isoDate(11), tasks: ["김영희 가정방문", "서류정리"], notes: "방문 시 건강 악화 징후 확인" }], weeklyGoals: "사례관리 3건 완료", achievements: "2건 완료, 1건 진행중", nextWeekPlan: "박철수 사례 중간평가", submittedAt: isoTimestamp(14, 17), facilitySnapshot: fs1, status: "submitted" }, 14),
    makeDoc({ workLogNo: "WL-202603-0002", staffSnapshot: { staffId: staffIds[1].toString(), staffNo: "STF-202603-0002", name: "최봉사" }, weekStartDate: isoDate(10), weekEndDate: isoDate(14), dailyEntries: [{ date: isoDate(10), tasks: ["봉사자 배치", "급식봉사 관리"], notes: "" }, { date: isoDate(11), tasks: ["학습지도 봉사 관리", "봉사시간 정리"], notes: "" }, { date: isoDate(12), tasks: ["봉사자 모집 공고 작성", "1365 시스템 등록"], notes: "" }], weeklyGoals: "봉사자 신규 모집 3명", achievements: "신규 모집 2명 완료", nextWeekPlan: "봉사자 오리엔테이션 진행", submittedAt: isoTimestamp(14, 17), facilitySnapshot: fs1, status: "submitted" }, 14),
    makeDoc({ workLogNo: "WL-202603-0003", staffSnapshot: { staffId: staffIds[0].toString(), staffNo: "STF-202603-0001", name: "이사복" }, weekStartDate: isoDate(17), weekEndDate: isoDate(21), dailyEntries: [{ date: isoDate(17), tasks: ["사례회의 참석", "문지영 초기상담"], notes: "주거환경 열악, 긴급지원 필요" }, { date: isoDate(18), tasks: ["임동혁 중간평가", "사례계획 수정"], notes: "" }, { date: isoDate(19), tasks: ["직원교육 참석", "서류작업"], notes: "" }], weeklyGoals: "신규사례 2건 접수, 중간평가 1건", achievements: "신규사례 2건 접수 완료, 중간평가 1건 완료", nextWeekPlan: "문지영 사례계획 수립, 윤희정 재활연계", submittedAt: isoTimestamp(21, 17), facilitySnapshot: fs1, status: "approved" }, 21),
    makeDoc({ workLogNo: "WL-202603-0004", staffSnapshot: { staffId: staffIds[7].toString(), staffNo: "STF-202603-0008", name: "강코디" }, weekStartDate: isoDate(17), weekEndDate: isoDate(21), dailyEntries: [{ date: isoDate(17), tasks: ["실버건강교실 2회차 진행", "출석체크"], notes: "참여자 17명" }, { date: isoDate(18), tasks: ["아동방과후교실 교재 준비", "강사 미팅"], notes: "" }, { date: isoDate(20), tasks: ["만족도조사 결과 정리", "보고서 작성"], notes: "" }], weeklyGoals: "프로그램 2건 운영, 만족도조사 분석", achievements: "프로그램 2건 정상 운영, 만족도 분석 완료", nextWeekPlan: "실버건강교실 3회차, 치매예방 2회차 준비", submittedAt: isoTimestamp(21, 16), facilitySnapshot: fs1, status: "submitted" }, 21),
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
  const acctUnitId2 = new ObjectId();
  const accountingUnits = [
    makeDoc({ _id: acctUnitId, code: "HQ-001", name: "행복종합사회복지관 회계", currency: "KRW", country: "KR", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ _id: acctUnitId2, code: "HQ-002", name: "은빛노인요양원 회계", currency: "KRW", country: "KR", facilitySnapshot: fs2, status: "active" }),
  ];

  const acctUnitSnap = { accountingUnitId: acctUnitId.toString(), code: "HQ-001", name: "행복종합사회복지관 회계" };

  // ── Vehicle Schedules ──
  const vehicleSchedules = [
    makeDoc({ scheduleNo: "VS-202603-0001", vehicleSnapshot: { vehicleId: vehicleIds[0].toString(), vehicleNo: "VEH-202603-0001", licensePlate: "12가 3456" }, driverSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, destination: "강남구보건소", departureTime: isoTimestamp(10, 9, 0), returnTime: isoTimestamp(10, 11, 30), mileage: 24, purpose: "이용자 병원 송영", facilitySnapshot: fs1, status: "completed" }, 10),
    makeDoc({ scheduleNo: "VS-202603-0002", vehicleSnapshot: { vehicleId: vehicleIds[0].toString(), vehicleNo: "VEH-202603-0001", licensePlate: "12가 3456" }, driverSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, destination: "서울시청", departureTime: isoTimestamp(17, 13, 0), returnTime: isoTimestamp(17, 16, 30), mileage: 18, purpose: "협의회 참석자 이동", facilitySnapshot: fs1, status: "completed" }, 17),
    makeDoc({ scheduleNo: "VS-202603-0003", vehicleSnapshot: { vehicleId: vehicleIds[0].toString(), vehicleNo: "VEH-202603-0001", licensePlate: "12가 3456" }, driverSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, destination: "서울재활병원", departureTime: isoTimestamp(20, 8, 30), returnTime: isoTimestamp(20, 12, 0), mileage: 35, purpose: "윤희정 이용자 재활치료 송영", facilitySnapshot: fs1, status: "completed" }, 20),
    makeDoc({ scheduleNo: "VS-202603-0004", vehicleSnapshot: { vehicleId: vehicleIds[0].toString(), vehicleNo: "VEH-202603-0001", licensePlate: "12가 3456" }, driverSnapshot: { staffId: staffIds[5].toString(), staffNo: "STF-202603-0006", name: "오운전" }, destination: "관악구 자택", departureTime: isoTimestamp(24, 9, 0), returnTime: null, mileage: 0, purpose: "실버건강교실 참여자 송영", facilitySnapshot: fs1, status: "scheduled" }, 23),
  ];

  // ── Chart of Accounts ──
  const chartOfAccounts = [
    // 자산 (1xxx)
    makeDoc({ code: "1100", name: "유동자산", accountType: "asset", level: 1, parentCode: null, facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "1101", name: "현금", accountType: "asset", level: 2, parentCode: "1100", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "1102", name: "보통예금", accountType: "asset", level: 2, parentCode: "1100", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "1103", name: "미수금", accountType: "asset", level: 2, parentCode: "1100", facilitySnapshot: fs1, status: "active" }),
    // 부채 (2xxx)
    makeDoc({ code: "2100", name: "유동부채", accountType: "liability", level: 1, parentCode: null, facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "2101", name: "미지급금", accountType: "liability", level: 2, parentCode: "2100", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "2102", name: "예수금", accountType: "liability", level: 2, parentCode: "2100", facilitySnapshot: fs1, status: "active" }),
    // 순자산 (3xxx)
    makeDoc({ code: "3100", name: "순자산", accountType: "equity", level: 1, parentCode: null, facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "3101", name: "기본순자산", accountType: "equity", level: 2, parentCode: "3100", facilitySnapshot: fs1, status: "active" }),
    // 수익 (4xxx)
    makeDoc({ code: "4100", name: "사업수익", accountType: "revenue", level: 1, parentCode: null, facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "4101", name: "보조금수입", accountType: "revenue", level: 2, parentCode: "4100", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "4102", name: "후원금수입", accountType: "revenue", level: 2, parentCode: "4100", facilitySnapshot: fs1, status: "active" }),
    // 비용 (5xxx)
    makeDoc({ code: "5100", name: "사업비용", accountType: "expense", level: 1, parentCode: null, facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "5101", name: "인건비", accountType: "expense", level: 2, parentCode: "5100", facilitySnapshot: fs1, status: "active" }),
    makeDoc({ code: "5102", name: "사무용품비", accountType: "expense", level: 2, parentCode: "5100", facilitySnapshot: fs1, status: "active" }),
  ];

  // ── Journal Entries ──
  const journalEntries = [
    makeDoc({ entryNo: "JE-202603-0001", date: isoDate(2), description: "2026년 1분기 보조금 수입", debitEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 250000000 }], creditEntries: [{ accountCode: "4101", accountName: "보조금수입", amount: 250000000 }], totalAmount: 250000000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 2),
    makeDoc({ entryNo: "JE-202603-0002", date: isoDate(5), description: "김후원 정기후원금 입금", debitEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 100000 }], creditEntries: [{ accountCode: "4102", accountName: "후원금수입", amount: 100000 }], totalAmount: 100000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 5),
    makeDoc({ entryNo: "JE-202603-0003", date: isoDate(8), description: "서울복지재단 후원금 입금", debitEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 10000000 }], creditEntries: [{ accountCode: "4102", accountName: "후원금수입", amount: 10000000 }], totalAmount: 10000000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 8),
    makeDoc({ entryNo: "JE-202603-0004", date: isoDate(10), description: "3월 급여 지급", debitEntries: [{ accountCode: "5101", accountName: "인건비", amount: 25000000 }], creditEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 25000000 }], totalAmount: 25000000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 10),
    makeDoc({ entryNo: "JE-202603-0005", date: isoDate(12), description: "사무용품 구입 (A4용지, 토너 등)", debitEntries: [{ accountCode: "5102", accountName: "사무용품비", amount: 235000 }], creditEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 235000 }], totalAmount: 235000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 12),
    makeDoc({ entryNo: "JE-202603-0006", date: isoDate(15), description: "(주)사랑나눔 후원금 입금", debitEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 5000000 }], creditEntries: [{ accountCode: "4102", accountName: "후원금수입", amount: 5000000 }], totalAmount: 5000000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 15),
    makeDoc({ entryNo: "JE-202603-0007", date: isoDate(18), description: "실버건강교실 프로그램 비용 지급", debitEntries: [{ accountCode: "5100", accountName: "사업비용", amount: 800000 }], creditEntries: [{ accountCode: "1102", accountName: "보통예금", amount: 800000 }], totalAmount: 800000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "posted" }, 18),
    makeDoc({ entryNo: "JE-202603-0008", date: isoDate(22), description: "전기요금 미지급 처리", debitEntries: [{ accountCode: "5100", accountName: "사업비용", amount: 1200000 }], creditEntries: [{ accountCode: "2101", accountName: "미지급금", amount: 1200000 }], totalAmount: 1200000, accountingUnitSnapshot: acctUnitSnap, facilitySnapshot: fs1, status: "draft" }, 22),
  ];

  // ── Approval Templates ──
  const approvalTemplates = [
    makeDoc({ templateName: "사례종결보고서", fields: [{ fieldName: "대상자명", fieldType: "text", required: true }, { fieldName: "종결사유", fieldType: "select", required: true }, { fieldName: "사후관리계획", fieldType: "textarea", required: true }], approvalLineTemplate: [{ step: 1, role: "담당자" }, { step: 2, role: "팀장" }, { step: 3, role: "센터장" }], facilitySnapshot: fs1, status: "active" }),
    makeDoc({ templateName: "프로그램 계획서", fields: [{ fieldName: "프로그램명", fieldType: "text", required: true }, { fieldName: "대상", fieldType: "text", required: true }, { fieldName: "예산", fieldType: "number", required: true }, { fieldName: "기간", fieldType: "dateRange", required: true }], approvalLineTemplate: [{ step: 1, role: "담당자" }, { step: 2, role: "팀장" }], facilitySnapshot: fs1, status: "active" }),
    makeDoc({ templateName: "지출결의서", fields: [{ fieldName: "지출항목", fieldType: "text", required: true }, { fieldName: "금액", fieldType: "number", required: true }, { fieldName: "지출사유", fieldType: "textarea", required: true }, { fieldName: "증빙자료", fieldType: "file", required: false }], approvalLineTemplate: [{ step: 1, role: "담당자" }, { step: 2, role: "팀장" }, { step: 3, role: "센터장" }], facilitySnapshot: fs1, status: "active" }),
    makeDoc({ templateName: "휴가신청서", fields: [{ fieldName: "휴가종류", fieldType: "select", required: true }, { fieldName: "시작일", fieldType: "date", required: true }, { fieldName: "종료일", fieldType: "date", required: true }, { fieldName: "사유", fieldType: "textarea", required: false }], approvalLineTemplate: [{ step: 1, role: "팀장" }], facilitySnapshot: fs1, status: "active" }),
  ];

  // ── Document Issues ──
  const documentIssues = [
    makeDoc({ documentNo: "DOC-202603-0001", templateType: "재직증명서", formData: { name: "이사복", position: "사회복지사", department: "사례관리팀", employmentDate: "2020-03-01" }, issuedDate: isoDate(8), issuerId: userAdminId.toString(), facilitySnapshot: fs1, status: "issued" }, 8),
    makeDoc({ documentNo: "DOC-202603-0002", templateType: "경력증명서", formData: { name: "최봉사", position: "사회복지사", department: "자원봉사팀", employmentDate: "2021-06-01", careerYears: 4 }, issuedDate: isoDate(12), issuerId: userAdminId.toString(), facilitySnapshot: fs1, status: "issued" }, 12),
    makeDoc({ documentNo: "DOC-202603-0003", templateType: "봉사활동확인서", formData: { volunteerName: "한봉사", totalHours: 48, period: "2026-01 ~ 2026-03" }, issuedDate: isoDate(20), issuerId: userWorker2Id.toString(), facilitySnapshot: fs1, status: "issued" }, 20),
    makeDoc({ documentNo: "DOC-202603-0004", templateType: "후원금영수증", formData: { donorName: "김후원", amount: 300000, period: "2026-01 ~ 2026-03", purpose: "사회복지사업" }, issuedDate: isoDate(22), issuerId: userAdminId.toString(), facilitySnapshot: fs1, status: "draft" }, 22),
  ];

  // ── Official Numbers ──
  const officialNumbers = [
    makeDoc({ category: "공문", year: 2026, sequence: 15, generatedNo: "복지-2026-015", facilitySnapshot: fs1 }, 20),
    makeDoc({ category: "내부문서", year: 2026, sequence: 8, generatedNo: "내부-2026-008", facilitySnapshot: fs1 }, 22),
  ];

  // ── Statistics Snapshots ──
  const statisticsSnapshots = [
    makeDoc({ month: "2026-01", facilitySnapshot: fs1, data: { totalClients: 12, newClients: 5, closedCases: 0, totalDonations: 8500000, volunteerHours: 32, programSessions: 4 } }, 0),
    makeDoc({ month: "2026-02", facilitySnapshot: fs1, data: { totalClients: 16, newClients: 4, closedCases: 0, totalDonations: 18350000, volunteerHours: 48, programSessions: 6 } }, 0),
    makeDoc({ month: "2026-03", facilitySnapshot: fs1, data: { totalClients: 20, newClients: 6, closedCases: 2, totalDonations: 38450000, volunteerHours: 56, programSessions: 5 } }, 24),
  ];

  // ── AP Invoices ──
  const apInvoices = [
    makeDoc({ invoiceNo: "AP-202603-0001", vendorName: "대한사무기기", description: "복합기 토너 및 A4용지 납품", amount: 235000, dueDate: isoDate(20), facilitySnapshot: fs1, status: "paid" }, 12),
    makeDoc({ invoiceNo: "AP-202603-0002", vendorName: "서울전기", description: "3월 전기요금", amount: 1200000, dueDate: isoDate(28), facilitySnapshot: fs1, status: "pending" }, 22),
    makeDoc({ invoiceNo: "AP-202603-0003", vendorName: "맛나식품", description: "급식 재료비 (3월)", amount: 3500000, dueDate: isoDate(25), facilitySnapshot: fs1, status: "pending" }, 20),
  ];

  // ── AR Invoices ──
  const arInvoices = [
    makeDoc({ invoiceNo: "AR-202603-0001", clientName: "강남구청", description: "노인요양 서비스 이용료 (3월)", amount: 8500000, dueDate: isoDate(28), facilitySnapshot: fs2, status: "pending" }, 15),
    makeDoc({ invoiceNo: "AR-202603-0002", clientName: "서울특별시", description: "프로그램 위탁운영비 정산", amount: 5000000, dueDate: isoDate(25), facilitySnapshot: fs1, status: "collected" }, 10),
  ];

  // ── Insert All ──
  if (shouldDryRun) {
    console.log("\n📋 Dry run — no data inserted.");
    const allData: Record<string, unknown[]> = {
      facilities, orgUnits, roles, users, clients, needs_assessments: needsAssessments,
      case_plans: casePlans, service_linkages: serviceLinkages, counseling_records: counselingRecords,
      case_closures: caseClosures, programs, program_sessions: programSessions,
      program_participants: programParticipants, satisfaction_surveys: satisfactionSurveys,
      performance_evaluations: performanceEvaluations,
      donors, donations, in_kind_donations: inKindDonations,
      volunteers, volunteer_activities: volunteerActivities, volunteer_hours: volunteerHours,
      staff: staffDocs, hr_attendance: hrAttendance,
      facility_rooms: facilityRooms, facility_supplies: facilitySupplies,
      vehicles, vehicle_schedules: vehicleSchedules, subsidies,
      accounting_units: accountingUnits, chart_of_accounts: chartOfAccounts,
      journal_entries: journalEntries, ap_invoices: apInvoices, ar_invoices: arInvoices,
      approval_documents: approvalDocuments, approval_templates: approvalTemplates,
      circulation_posts: circulationPosts, document_issues: documentIssues,
      official_numbers: officialNumbers,
      schedules, work_logs: workLogs,
      statistics_snapshots: statisticsSnapshots,
      integration_configs: integrationConfigs,
    };
    let total = 0;
    for (const [name, docs] of Object.entries(allData)) {
      console.log(`   ${name}: ${docs.length} documents`);
      total += docs.length;
    }
    console.log(`\n   📊 Total: ${total} documents`);
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
      ["program_participants", programParticipants],
      ["satisfaction_surveys", satisfactionSurveys],
      ["performance_evaluations", performanceEvaluations],
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
      ["vehicle_schedules", vehicleSchedules],
      ["subsidies", subsidies],
      ["accounting_units", accountingUnits],
      ["chart_of_accounts", chartOfAccounts],
      ["journal_entries", journalEntries],
      ["ap_invoices", apInvoices],
      ["ar_invoices", arInvoices],
      ["approval_documents", approvalDocuments],
      ["approval_templates", approvalTemplates],
      ["circulation_posts", circulationPosts],
      ["document_issues", documentIssues],
      ["official_numbers", officialNumbers],
      ["schedules", schedules],
      ["work_logs", workLogs],
      ["statistics_snapshots", statisticsSnapshots],
      ["integration_configs", integrationConfigs],
    ];

    let total = 0;
    for (const [collectionName, docs] of insertions) {
      if (docs.length === 0) continue;
      const result = await db.collection(collectionName).insertMany(docs as Record<string, unknown>[]);
      console.log(`   ✅ ${collectionName}: ${result.insertedCount} inserted`);
      total += result.insertedCount;
    }
    console.log(`\n   📊 Total: ${total} documents inserted`);
  }

  console.log("\n🎉 Seed complete!");
  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
