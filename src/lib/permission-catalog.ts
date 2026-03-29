export type PermissionCode =
  | "dashboard.read"
  | "client-case.read"
  | "client-case.write"
  | "program.read"
  | "program.write"
  | "donation-volunteer.read"
  | "donation-volunteer.write"
  | "facility-hr.read"
  | "facility-hr.write"
  | "finance.read"
  | "finance.write"
  | "approval.read"
  | "approval.write"
  | "circulation.read"
  | "circulation.write"
  | "document.read"
  | "document.write"
  | "schedule.read"
  | "schedule.write"
  | "work-log.read"
  | "work-log.write"
  | "statistics.read"
  | "admin.read"
  | "admin.write"
  | "operations.read"
  | "operations.write"
  | "workspace.read"
  | "workspace.write"
  | "navigation.search"
  | "notifications.read"
  | "personalization.read";

export type ActionPermissionCode =
  | "client.create"
  | "client.update"
  | "client.archive"
  | "needs-assessment.create"
  | "needs-assessment.update"
  | "case-plan.create"
  | "case-plan.update"
  | "case-plan.approve"
  | "case-plan.reject"
  | "service-linkage.create"
  | "service-linkage.update"
  | "counseling.create"
  | "counseling.update"
  | "case-closure.create"
  | "case-closure.update"
  | "case-closure.approve"
  | "program.create"
  | "program.update"
  | "program.archive"
  | "program-session.create"
  | "program-session.update"
  | "participant.enroll"
  | "participant.withdraw"
  | "attendance.record"
  | "attendance.update"
  | "satisfaction-survey.create"
  | "satisfaction-survey.update"
  | "performance-eval.create"
  | "performance-eval.update"
  | "donor.create"
  | "donor.update"
  | "donor.archive"
  | "donation.create"
  | "donation.update"
  | "donation.receipt"
  | "in-kind-donation.create"
  | "in-kind-donation.update"
  | "in-kind-donation.distribute"
  | "volunteer.create"
  | "volunteer.update"
  | "volunteer.archive"
  | "volunteer-activity.create"
  | "volunteer-activity.update"
  | "volunteer-hours.record"
  | "volunteer-hours.approve"
  | "staff.create"
  | "staff.update"
  | "staff.archive"
  | "attendance-hr.record"
  | "attendance-hr.update"
  | "attendance-hr.approve"
  | "facility-room.create"
  | "facility-room.update"
  | "equipment.create"
  | "equipment.update"
  | "equipment.archive"
  | "supply.create"
  | "supply.update"
  | "supply.distribute"
  | "vehicle.create"
  | "vehicle.update"
  | "vehicle-schedule.create"
  | "vehicle-schedule.update"
  | "subsidy.create"
  | "subsidy.update"
  | "subsidy.submit"
  | "subsidy.approve"
  | "approval-doc.create"
  | "approval-doc.approve"
  | "approval-doc.reject"
  | "circulation.create"
  | "circulation.notify"
  | "document-issue.create"
  | "document-issue.update"
  | "official-number.generate"
  | "schedule.create"
  | "schedule.update"
  | "work-log.create"
  | "work-log.submit"
  | "accounting-unit.create"
  | "accounting-unit.update"
  | "accounting-unit.period-open"
  | "accounting-unit.period-close"
  | "accounting-unit.period-generate"
  | "account.create"
  | "account.update"
  | "account.archive"
  | "ap.create"
  | "ap.approve"
  | "ap.cancel-approval"
  | "ap.pay"
  | "ap.cancel-payment"
  | "ar.create"
  | "ar.issue"
  | "ar.cancel-issue"
  | "ar.collect"
  | "ar.cancel-collection"
  | "asset.create"
  | "asset.update"
  | "asset.archive"
  | "asset.restore"
  | "asset.depreciation-run"
  | "journal-entry.create"
  | "journal-entry.update"
  | "journal-entry.submit"
  | "journal-entry.post"
  | "journal-entry.reverse"
  | "workspace-post.create"
  | "workspace-post.update"
  | "workspace-post.request-review"
  | "workspace-post.approve"
  | "workspace-post.reject"
  | "workspace-post.archive"
  | "workspace-post.restore"
  | "admin.user.create"
  | "admin.user.update"
  | "admin.org.create"
  | "admin.org.update"
  | "admin.role.create"
  | "admin.role.update"
  | "admin.policy.create"
  | "admin.policy.update"
  | "ops-issue.create"
  | "ops-issue.update"
  | "ops-issue.assign"
  | "ops-staff.create"
  | "ops-staff.update"
  | "ops-handover.create"
  | "ops-handover.update"
  | "ops-report.generate";

export type KnownPermissionCode = PermissionCode | ActionPermissionCode;

export type PermissionMetadata = {
  label: string;
  description: string;
  domain: string;
};

export type PermissionSelectionGroup = {
  key: string;
  title: string;
  description: string;
  permissions: KnownPermissionCode[];
};

export const permissionCatalog: PermissionCode[] = [
  "dashboard.read",
  "client-case.read",
  "client-case.write",
  "program.read",
  "program.write",
  "donation-volunteer.read",
  "donation-volunteer.write",
  "facility-hr.read",
  "facility-hr.write",
  "finance.read",
  "finance.write",
  "approval.read",
  "approval.write",
  "circulation.read",
  "circulation.write",
  "document.read",
  "document.write",
  "schedule.read",
  "schedule.write",
  "work-log.read",
  "work-log.write",
  "statistics.read",
  "admin.read",
  "admin.write",
  "operations.read",
  "operations.write",
  "workspace.read",
  "workspace.write",
  "navigation.search",
  "notifications.read",
  "personalization.read",
];

export const permissionMetadataMap: Record<PermissionCode, PermissionMetadata> = {
  "dashboard.read": { label: "대시보드 조회", description: "현황판과 KPI를 조회합니다.", domain: "공통" },
  "client-case.read": { label: "이용자/사례 조회", description: "이용자, 욕구사정, 사례관리를 조회합니다.", domain: "이용자/사례" },
  "client-case.write": { label: "이용자/사례 변경", description: "이용자/사례 도메인 전체 변경 권한입니다.", domain: "이용자/사례" },
  "program.read": { label: "프로그램 조회", description: "프로그램 기획, 운영, 참여자를 조회합니다.", domain: "프로그램" },
  "program.write": { label: "프로그램 변경", description: "프로그램 도메인 전체 변경 권한입니다.", domain: "프로그램" },
  "donation-volunteer.read": { label: "후원/봉사 조회", description: "후원자, 후원금, 자원봉사를 조회합니다.", domain: "후원/봉사" },
  "donation-volunteer.write": { label: "후원/봉사 변경", description: "후원/봉사 도메인 전체 변경 권한입니다.", domain: "후원/봉사" },
  "facility-hr.read": { label: "시설/인사 조회", description: "직원, 근태, 시설, 비품, 차량을 조회합니다.", domain: "시설/인사" },
  "facility-hr.write": { label: "시설/인사 변경", description: "시설/인사 도메인 전체 변경 권한입니다.", domain: "시설/인사" },
  "finance.read": { label: "재무 조회", description: "전표, AP/AR, 자산, 보조금을 조회합니다.", domain: "재무" },
  "finance.write": { label: "재무 변경", description: "재무 도메인 전체 변경 권한입니다.", domain: "재무" },
  "approval.read": { label: "전자결재 조회", description: "결재 대기함, 기안, 문서함을 조회합니다.", domain: "업무지원" },
  "approval.write": { label: "전자결재 변경", description: "전자결재 도메인 전체 변경 권한입니다.", domain: "업무지원" },
  "circulation.read": { label: "공람함 조회", description: "문서 공람, 열람 현황을 조회합니다.", domain: "업무지원" },
  "circulation.write": { label: "공람함 변경", description: "공람함 도메인 전체 변경 권한입니다.", domain: "업무지원" },
  "document.read": { label: "발급/기안 조회", description: "문서 발급, 공문번호를 조회합니다.", domain: "업무지원" },
  "document.write": { label: "발급/기안 변경", description: "발급/기안 도메인 전체 변경 권한입니다.", domain: "업무지원" },
  "schedule.read": { label: "일정관리 조회", description: "일정, 캘린더를 조회합니다.", domain: "업무지원" },
  "schedule.write": { label: "일정관리 변경", description: "일정관리 도메인 전체 변경 권한입니다.", domain: "업무지원" },
  "work-log.read": { label: "업무일지 조회", description: "주간실적보고를 조회합니다.", domain: "업무지원" },
  "work-log.write": { label: "업무일지 변경", description: "업무일지 도메인 전체 변경 권한입니다.", domain: "업무지원" },
  "statistics.read": { label: "통계 조회", description: "이용자, 사례, 재무 통계를 조회합니다.", domain: "분석" },
  "admin.read": { label: "관리자 조회", description: "사용자, 조직, 역할, 정책을 조회합니다.", domain: "관리" },
  "admin.write": { label: "관리자 변경", description: "관리자 도메인 전체 변경 권한입니다.", domain: "관리" },
  "operations.read": { label: "AI 운영 조회", description: "이슈, 인수인계, 운영 보드를 조회합니다.", domain: "AI 운영" },
  "operations.write": { label: "AI 운영 변경", description: "이슈 등록, 인수인계 작성, 직원 배정 등을 수행합니다.", domain: "AI 운영" },
  "workspace.read": { label: "협업 조회", description: "공지, 자료실, 승인함을 조회합니다.", domain: "협업" },
  "workspace.write": { label: "협업 변경", description: "협업 도메인 전체 변경 권한입니다.", domain: "협업" },
  "navigation.search": { label: "전역 검색", description: "메뉴와 저장 뷰를 검색합니다.", domain: "공통" },
  "notifications.read": { label: "알림 조회", description: "개인 알림과 운영 알림을 확인합니다.", domain: "공통" },
  "personalization.read": { label: "개인화 조회", description: "저장 뷰와 개인 설정을 사용합니다.", domain: "공통" },
};

export const actionPermissionCatalog: ActionPermissionCode[] = [
  "client.create", "client.update", "client.archive",
  "needs-assessment.create", "needs-assessment.update",
  "case-plan.create", "case-plan.update", "case-plan.approve", "case-plan.reject",
  "service-linkage.create", "service-linkage.update",
  "counseling.create", "counseling.update",
  "case-closure.create", "case-closure.update", "case-closure.approve",
  "program.create", "program.update", "program.archive",
  "program-session.create", "program-session.update",
  "participant.enroll", "participant.withdraw",
  "attendance.record", "attendance.update",
  "satisfaction-survey.create", "satisfaction-survey.update",
  "performance-eval.create", "performance-eval.update",
  "donor.create", "donor.update", "donor.archive",
  "donation.create", "donation.update", "donation.receipt",
  "in-kind-donation.create", "in-kind-donation.update", "in-kind-donation.distribute",
  "volunteer.create", "volunteer.update", "volunteer.archive",
  "volunteer-activity.create", "volunteer-activity.update",
  "volunteer-hours.record", "volunteer-hours.approve",
  "staff.create", "staff.update", "staff.archive",
  "attendance-hr.record", "attendance-hr.update", "attendance-hr.approve",
  "facility-room.create", "facility-room.update",
  "equipment.create", "equipment.update", "equipment.archive",
  "supply.create", "supply.update", "supply.distribute",
  "vehicle.create", "vehicle.update",
  "vehicle-schedule.create", "vehicle-schedule.update",
  "subsidy.create", "subsidy.update", "subsidy.submit", "subsidy.approve",
  "approval-doc.create", "approval-doc.approve", "approval-doc.reject",
  "circulation.create", "circulation.notify",
  "document-issue.create", "document-issue.update", "official-number.generate",
  "schedule.create", "schedule.update",
  "work-log.create", "work-log.submit",
  "accounting-unit.create", "accounting-unit.update",
  "accounting-unit.period-open", "accounting-unit.period-close", "accounting-unit.period-generate",
  "account.create", "account.update", "account.archive",
  "ap.create", "ap.approve", "ap.cancel-approval", "ap.pay", "ap.cancel-payment",
  "ar.create", "ar.issue", "ar.cancel-issue", "ar.collect", "ar.cancel-collection",
  "asset.create", "asset.update", "asset.archive", "asset.restore", "asset.depreciation-run",
  "journal-entry.create", "journal-entry.update", "journal-entry.submit", "journal-entry.post", "journal-entry.reverse",
  "workspace-post.create", "workspace-post.update", "workspace-post.request-review",
  "workspace-post.approve", "workspace-post.reject", "workspace-post.archive", "workspace-post.restore",
  "admin.user.create", "admin.user.update",
  "admin.org.create", "admin.org.update",
  "admin.role.create", "admin.role.update",
  "admin.policy.create", "admin.policy.update",
  "ops-issue.create", "ops-issue.update", "ops-issue.assign",
  "ops-staff.create", "ops-staff.update",
  "ops-handover.create", "ops-handover.update",
  "ops-report.generate",
];

function createActionMetadata(label: string, description: string, domain: string): PermissionMetadata {
  return { label, description, domain };
}

export const actionPermissionMetadataMap: Record<ActionPermissionCode, PermissionMetadata> = {
  "client.create": createActionMetadata("이용자 등록", "이용자를 신규 등록합니다.", "이용자/사례"),
  "client.update": createActionMetadata("이용자 수정", "이용자 정보를 수정합니다.", "이용자/사례"),
  "client.archive": createActionMetadata("이용자 보관", "이용자를 비활성화합니다.", "이용자/사례"),
  "needs-assessment.create": createActionMetadata("욕구사정 등록", "욕구사정을 신규 등록합니다.", "이용자/사례"),
  "needs-assessment.update": createActionMetadata("욕구사정 수정", "욕구사정을 수정합니다.", "이용자/사례"),
  "case-plan.create": createActionMetadata("사례계획 등록", "사례계획을 신규 등록합니다.", "이용자/사례"),
  "case-plan.update": createActionMetadata("사례계획 수정", "사례계획을 수정합니다.", "이용자/사례"),
  "case-plan.approve": createActionMetadata("사례계획 승인", "사례계획 승인 상태를 처리합니다.", "이용자/사례"),
  "case-plan.reject": createActionMetadata("사례계획 반려", "사례계획을 반려합니다.", "이용자/사례"),
  "service-linkage.create": createActionMetadata("서비스연계 등록", "서비스연계를 신규 등록합니다.", "이용자/사례"),
  "service-linkage.update": createActionMetadata("서비스연계 수정", "서비스연계를 수정합니다.", "이용자/사례"),
  "counseling.create": createActionMetadata("상담 등록", "상담 기록을 등록합니다.", "이용자/사례"),
  "counseling.update": createActionMetadata("상담 수정", "상담 기록을 수정합니다.", "이용자/사례"),
  "case-closure.create": createActionMetadata("종결 등록", "사례 종결을 등록합니다.", "이용자/사례"),
  "case-closure.update": createActionMetadata("종결 수정", "사례 종결을 수정합니다.", "이용자/사례"),
  "case-closure.approve": createActionMetadata("종결 승인", "사례 종결을 승인합니다.", "이용자/사례"),
  "program.create": createActionMetadata("프로그램 등록", "프로그램을 신규 등록합니다.", "프로그램"),
  "program.update": createActionMetadata("프로그램 수정", "프로그램을 수정합니다.", "프로그램"),
  "program.archive": createActionMetadata("프로그램 보관", "프로그램을 보관합니다.", "프로그램"),
  "program-session.create": createActionMetadata("회차 등록", "프로그램 회차를 등록합니다.", "프로그램"),
  "program-session.update": createActionMetadata("회차 수정", "프로그램 회차를 수정합니다.", "프로그램"),
  "participant.enroll": createActionMetadata("참여자 등록", "프로그램 참여자를 등록합니다.", "프로그램"),
  "participant.withdraw": createActionMetadata("참여자 중도포기", "프로그램 참여자를 중도포기 처리합니다.", "프로그램"),
  "attendance.record": createActionMetadata("출석 기록", "프로그램 출석을 기록합니다.", "프로그램"),
  "attendance.update": createActionMetadata("출석 수정", "프로그램 출석을 수정합니다.", "프로그램"),
  "satisfaction-survey.create": createActionMetadata("만족도조사 등록", "만족도조사를 등록합니다.", "프로그램"),
  "satisfaction-survey.update": createActionMetadata("만족도조사 수정", "만족도조사를 수정합니다.", "프로그램"),
  "performance-eval.create": createActionMetadata("성과평가 등록", "성과평가를 등록합니다.", "프로그램"),
  "performance-eval.update": createActionMetadata("성과평가 수정", "성과평가를 수정합니다.", "프로그램"),
  "donor.create": createActionMetadata("후원자 등록", "후원자를 신규 등록합니다.", "후원/봉사"),
  "donor.update": createActionMetadata("후원자 수정", "후원자 정보를 수정합니다.", "후원/봉사"),
  "donor.archive": createActionMetadata("후원자 보관", "후원자를 비활성화합니다.", "후원/봉사"),
  "donation.create": createActionMetadata("후원금 등록", "후원금을 등록합니다.", "후원/봉사"),
  "donation.update": createActionMetadata("후원금 수정", "후원금을 수정합니다.", "후원/봉사"),
  "donation.receipt": createActionMetadata("영수증 발급", "후원 영수증을 발급합니다.", "후원/봉사"),
  "in-kind-donation.create": createActionMetadata("물품후원 등록", "물품후원을 등록합니다.", "후원/봉사"),
  "in-kind-donation.update": createActionMetadata("물품후원 수정", "물품후원을 수정합니다.", "후원/봉사"),
  "in-kind-donation.distribute": createActionMetadata("물품후원 배분", "물품후원을 배분합니다.", "후원/봉사"),
  "volunteer.create": createActionMetadata("자원봉사자 등록", "자원봉사자를 등록합니다.", "후원/봉사"),
  "volunteer.update": createActionMetadata("자원봉사자 수정", "자원봉사자를 수정합니다.", "후원/봉사"),
  "volunteer.archive": createActionMetadata("자원봉사자 보관", "자원봉사자를 비활성화합니다.", "후원/봉사"),
  "volunteer-activity.create": createActionMetadata("봉사활동 등록", "봉사활동을 등록합니다.", "후원/봉사"),
  "volunteer-activity.update": createActionMetadata("봉사활동 수정", "봉사활동을 수정합니다.", "후원/봉사"),
  "volunteer-hours.record": createActionMetadata("봉사시간 기록", "봉사시간을 기록합니다.", "후원/봉사"),
  "volunteer-hours.approve": createActionMetadata("봉사시간 승인", "봉사시간을 승인합니다.", "후원/봉사"),
  "staff.create": createActionMetadata("직원 등록", "직원을 신규 등록합니다.", "시설/인사"),
  "staff.update": createActionMetadata("직원 수정", "직원 정보를 수정합니다.", "시설/인사"),
  "staff.archive": createActionMetadata("직원 보관", "직원을 퇴직 처리합니다.", "시설/인사"),
  "attendance-hr.record": createActionMetadata("근태 기록", "근태를 기록합니다.", "시설/인사"),
  "attendance-hr.update": createActionMetadata("근태 수정", "근태를 수정합니다.", "시설/인사"),
  "attendance-hr.approve": createActionMetadata("근태 승인", "근태를 승인합니다.", "시설/인사"),
  "facility-room.create": createActionMetadata("시설공간 등록", "시설 공간을 등록합니다.", "시설/인사"),
  "facility-room.update": createActionMetadata("시설공간 수정", "시설 공간을 수정합니다.", "시설/인사"),
  "equipment.create": createActionMetadata("비품 등록", "비품을 등록합니다.", "시설/인사"),
  "equipment.update": createActionMetadata("비품 수정", "비품을 수정합니다.", "시설/인사"),
  "equipment.archive": createActionMetadata("비품 보관", "비품을 폐기합니다.", "시설/인사"),
  "supply.create": createActionMetadata("소모품 등록", "소모품을 등록합니다.", "시설/인사"),
  "supply.update": createActionMetadata("소모품 수정", "소모품을 수정합니다.", "시설/인사"),
  "supply.distribute": createActionMetadata("소모품 배분", "소모품을 배분합니다.", "시설/인사"),
  "vehicle.create": createActionMetadata("차량 등록", "차량을 등록합니다.", "시설/인사"),
  "vehicle.update": createActionMetadata("차량 수정", "차량을 수정합니다.", "시설/인사"),
  "vehicle-schedule.create": createActionMetadata("차량일정 등록", "차량 운행일정을 등록합니다.", "시설/인사"),
  "vehicle-schedule.update": createActionMetadata("차량일정 수정", "차량 운행일정을 수정합니다.", "시설/인사"),
  "subsidy.create": createActionMetadata("보조금 등록", "보조금을 등록합니다.", "재무"),
  "subsidy.update": createActionMetadata("보조금 수정", "보조금을 수정합니다.", "재무"),
  "subsidy.submit": createActionMetadata("보조금 제출", "보조금 정산을 제출합니다.", "재무"),
  "subsidy.approve": createActionMetadata("보조금 승인", "보조금 교부결정을 승인합니다.", "재무"),
  "approval-doc.create": createActionMetadata("결재문서 기안", "결재문서를 기안합니다.", "업무지원"),
  "approval-doc.approve": createActionMetadata("결재문서 승인", "결재문서를 승인합니다.", "업무지원"),
  "approval-doc.reject": createActionMetadata("결재문서 반려", "결재문서를 반려합니다.", "업무지원"),
  "circulation.create": createActionMetadata("공람 등록", "공람 문서를 등록합니다.", "업무지원"),
  "circulation.notify": createActionMetadata("공람 알림", "공람 대상자에게 알림을 보냅니다.", "업무지원"),
  "document-issue.create": createActionMetadata("문서발급 등록", "문서를 발급합니다.", "업무지원"),
  "document-issue.update": createActionMetadata("문서발급 수정", "발급 문서를 수정합니다.", "업무지원"),
  "official-number.generate": createActionMetadata("공문번호 생성", "공문번호를 생성합니다.", "업무지원"),
  "schedule.create": createActionMetadata("일정 등록", "일정을 등록합니다.", "업무지원"),
  "schedule.update": createActionMetadata("일정 수정", "일정을 수정합니다.", "업무지원"),
  "work-log.create": createActionMetadata("업무일지 등록", "업무일지를 작성합니다.", "업무지원"),
  "work-log.submit": createActionMetadata("업무일지 제출", "업무일지를 제출합니다.", "업무지원"),
  "accounting-unit.create": createActionMetadata("회계단위 등록", "회계단위를 등록합니다.", "재무"),
  "accounting-unit.update": createActionMetadata("회계단위 수정", "회계단위를 수정합니다.", "재무"),
  "accounting-unit.period-open": createActionMetadata("회계기간 열기", "회계기간을 열기 상태로 전환합니다.", "재무"),
  "accounting-unit.period-close": createActionMetadata("회계기간 닫기", "회계기간을 닫기 상태로 전환합니다.", "재무"),
  "accounting-unit.period-generate": createActionMetadata("회계기간 생성", "다음 회계기간을 생성합니다.", "재무"),
  "account.create": createActionMetadata("계정과목 등록", "계정과목을 등록합니다.", "재무"),
  "account.update": createActionMetadata("계정과목 수정", "계정과목을 수정합니다.", "재무"),
  "account.archive": createActionMetadata("계정과목 보관", "계정과목을 보관합니다.", "재무"),
  "ap.create": createActionMetadata("AP 등록", "매입채무/AP를 등록합니다.", "재무"),
  "ap.approve": createActionMetadata("AP 승인", "AP 승인 및 자동 전표 초안을 생성합니다.", "재무"),
  "ap.cancel-approval": createActionMetadata("AP 승인 취소", "승인된 AP를 대기 상태로 되돌립니다.", "재무"),
  "ap.pay": createActionMetadata("AP 지급", "AP 지급 또는 전액 정산을 처리합니다.", "재무"),
  "ap.cancel-payment": createActionMetadata("AP 지급 취소", "AP 지급 이력을 취소합니다.", "재무"),
  "ar.create": createActionMetadata("AR 등록", "매출채권/AR을 등록합니다.", "재무"),
  "ar.issue": createActionMetadata("AR 발행", "AR 발행과 매출전표 초안 생성을 처리합니다.", "재무"),
  "ar.cancel-issue": createActionMetadata("AR 발행 취소", "AR 발행을 취소합니다.", "재무"),
  "ar.collect": createActionMetadata("AR 수금", "AR 수금을 등록합니다.", "재무"),
  "ar.cancel-collection": createActionMetadata("AR 수금 취소", "AR 수금 이력을 취소합니다.", "재무"),
  "asset.create": createActionMetadata("자산 등록", "고정자산을 등록합니다.", "재무"),
  "asset.update": createActionMetadata("자산 수정", "고정자산을 수정합니다.", "재무"),
  "asset.archive": createActionMetadata("자산 보관", "고정자산을 보관합니다.", "재무"),
  "asset.restore": createActionMetadata("자산 복원", "보관 자산을 복원합니다.", "재무"),
  "asset.depreciation-run": createActionMetadata("감가상각 배치", "감가상각 스케줄과 장부 금액을 재계산합니다.", "재무"),
  "journal-entry.create": createActionMetadata("전표 등록", "수기 전표를 신규 등록합니다.", "재무"),
  "journal-entry.update": createActionMetadata("전표 수정", "초안 전표를 수정합니다.", "재무"),
  "journal-entry.submit": createActionMetadata("전표 제출", "전표를 제출 상태로 전환합니다.", "재무"),
  "journal-entry.post": createActionMetadata("전표 확정", "전표를 posted 상태로 확정합니다.", "재무"),
  "journal-entry.reverse": createActionMetadata("전표 역분개", "확정 전표의 역분개를 생성합니다.", "재무"),
  "workspace-post.create": createActionMetadata("게시물 등록", "공지/자료실 게시물을 등록합니다.", "협업"),
  "workspace-post.update": createActionMetadata("게시물 수정", "공지/자료실 게시물을 수정합니다.", "협업"),
  "workspace-post.request-review": createActionMetadata("게시 검토 요청", "게시물 검토 요청을 생성합니다.", "협업"),
  "workspace-post.approve": createActionMetadata("게시 승인", "게시물 게시 승인을 처리합니다.", "협업"),
  "workspace-post.reject": createActionMetadata("게시 반려", "게시물 게시 요청을 반려합니다.", "협업"),
  "workspace-post.archive": createActionMetadata("게시물 보관", "게시물을 보관합니다.", "협업"),
  "workspace-post.restore": createActionMetadata("게시물 복원", "보관된 게시물을 복원합니다.", "협업"),
  "admin.user.create": createActionMetadata("사용자 등록", "관리자에서 사용자를 등록합니다.", "관리"),
  "admin.user.update": createActionMetadata("사용자 수정", "관리자에서 사용자를 수정합니다.", "관리"),
  "admin.org.create": createActionMetadata("조직 등록", "관리자에서 조직을 등록합니다.", "관리"),
  "admin.org.update": createActionMetadata("조직 수정", "관리자에서 조직을 수정합니다.", "관리"),
  "admin.role.create": createActionMetadata("역할 등록", "관리자에서 역할을 등록합니다.", "관리"),
  "admin.role.update": createActionMetadata("역할 수정", "관리자에서 역할을 수정합니다.", "관리"),
  "admin.policy.create": createActionMetadata("정책 등록", "관리자에서 정책을 등록합니다.", "관리"),
  "admin.policy.update": createActionMetadata("정책 수정", "관리자에서 정책을 수정합니다.", "관리"),
  "ops-issue.create": createActionMetadata("이슈 등록", "운영 이슈를 등록합니다.", "AI 운영"),
  "ops-issue.update": createActionMetadata("이슈 수정", "운영 이슈를 수정합니다.", "AI 운영"),
  "ops-issue.assign": createActionMetadata("이슈 배정", "운영 이슈를 직원에게 배정합니다.", "AI 운영"),
  "ops-staff.create": createActionMetadata("운영직원 등록", "운영 직원을 등록합니다.", "AI 운영"),
  "ops-staff.update": createActionMetadata("운영직원 수정", "운영 직원 정보를 수정합니다.", "AI 운영"),
  "ops-handover.create": createActionMetadata("인수인계 등록", "인수인계를 등록합니다.", "AI 운영"),
  "ops-handover.update": createActionMetadata("인수인계 수정", "인수인계를 수정합니다.", "AI 운영"),
  "ops-report.generate": createActionMetadata("주간보고 생성", "AI 주간 운영보고를 생성합니다.", "AI 운영"),
};

export const allPermissionCatalog: KnownPermissionCode[] = [
  ...permissionCatalog,
  ...actionPermissionCatalog,
];

const legacyPermissionImplications: Partial<Record<PermissionCode, ActionPermissionCode[]>> = {
  "client-case.write": [
    "client.create", "client.update", "client.archive",
    "needs-assessment.create", "needs-assessment.update",
    "case-plan.create", "case-plan.update", "case-plan.approve", "case-plan.reject",
    "service-linkage.create", "service-linkage.update",
    "counseling.create", "counseling.update",
    "case-closure.create", "case-closure.update", "case-closure.approve",
  ],
  "program.write": [
    "program.create", "program.update", "program.archive",
    "program-session.create", "program-session.update",
    "participant.enroll", "participant.withdraw",
    "attendance.record", "attendance.update",
    "satisfaction-survey.create", "satisfaction-survey.update",
    "performance-eval.create", "performance-eval.update",
  ],
  "donation-volunteer.write": [
    "donor.create", "donor.update", "donor.archive",
    "donation.create", "donation.update", "donation.receipt",
    "in-kind-donation.create", "in-kind-donation.update", "in-kind-donation.distribute",
    "volunteer.create", "volunteer.update", "volunteer.archive",
    "volunteer-activity.create", "volunteer-activity.update",
    "volunteer-hours.record", "volunteer-hours.approve",
  ],
  "facility-hr.write": [
    "staff.create", "staff.update", "staff.archive",
    "attendance-hr.record", "attendance-hr.update", "attendance-hr.approve",
    "facility-room.create", "facility-room.update",
    "equipment.create", "equipment.update", "equipment.archive",
    "supply.create", "supply.update", "supply.distribute",
    "vehicle.create", "vehicle.update",
    "vehicle-schedule.create", "vehicle-schedule.update",
  ],
  "finance.write": [
    "subsidy.create", "subsidy.update", "subsidy.submit", "subsidy.approve",
    "accounting-unit.create", "accounting-unit.update",
    "accounting-unit.period-open", "accounting-unit.period-close", "accounting-unit.period-generate",
    "account.create", "account.update", "account.archive",
    "ap.create", "ap.approve", "ap.cancel-approval", "ap.pay", "ap.cancel-payment",
    "ar.create", "ar.issue", "ar.cancel-issue", "ar.collect", "ar.cancel-collection",
    "asset.create", "asset.update", "asset.archive", "asset.restore", "asset.depreciation-run",
    "journal-entry.create", "journal-entry.update", "journal-entry.submit", "journal-entry.post", "journal-entry.reverse",
  ],
  "approval.write": ["approval-doc.create", "approval-doc.approve", "approval-doc.reject"],
  "circulation.write": ["circulation.create", "circulation.notify"],
  "document.write": ["document-issue.create", "document-issue.update", "official-number.generate"],
  "schedule.write": ["schedule.create", "schedule.update"],
  "work-log.write": ["work-log.create", "work-log.submit"],
  "workspace.write": [
    "workspace-post.create", "workspace-post.update", "workspace-post.request-review",
    "workspace-post.approve", "workspace-post.reject", "workspace-post.archive", "workspace-post.restore",
  ],
  "admin.write": [
    "admin.user.create", "admin.user.update",
    "admin.org.create", "admin.org.update",
    "admin.role.create", "admin.role.update",
    "admin.policy.create", "admin.policy.update",
  ],
  "operations.write": [
    "ops-issue.create", "ops-issue.update", "ops-issue.assign",
    "ops-staff.create", "ops-staff.update",
    "ops-handover.create", "ops-handover.update",
    "ops-report.generate",
  ],
};

export function expandPermissionCodes(codes: string[]): KnownPermissionCode[] {
  const expanded = new Set<string>();

  for (const code of codes) {
    if (!code) {
      continue;
    }

    expanded.add(code);

    const impliedActions = legacyPermissionImplications[code as PermissionCode] ?? [];
    for (const impliedAction of impliedActions) {
      expanded.add(impliedAction);
    }
  }

  return [...expanded].filter((code): code is KnownPermissionCode =>
    allPermissionCatalog.includes(code as KnownPermissionCode),
  );
}

export function getPermissionMetadata(permission: string): PermissionMetadata {
  return (
    permissionMetadataMap[permission as PermissionCode] ??
    actionPermissionMetadataMap[permission as ActionPermissionCode] ?? {
      label: permission,
      description: "등록되지 않은 권한 코드",
      domain: "사용자 정의",
    }
  );
}

export function isKnownPermissionCode(code: string) {
  return allPermissionCatalog.includes(code as KnownPermissionCode);
}

export const permissionSelectionGroups: PermissionSelectionGroup[] = [
  {
    key: "legacy",
    title: "레거시 모듈 권한",
    description: "기존 read/write 권한입니다. 점진적으로 액션 권한으로 대체합니다.",
    permissions: permissionCatalog,
  },
  {
    key: "client-case",
    title: "이용자/사례 액션 권한",
    description: "이용자, 욕구사정, 사례관리 액션입니다.",
    permissions: [
      "client.create", "client.update", "client.archive",
      "needs-assessment.create", "needs-assessment.update",
      "case-plan.create", "case-plan.update", "case-plan.approve", "case-plan.reject",
      "service-linkage.create", "service-linkage.update",
      "counseling.create", "counseling.update",
      "case-closure.create", "case-closure.update", "case-closure.approve",
    ],
  },
  {
    key: "program",
    title: "프로그램 액션 권한",
    description: "프로그램 기획, 운영, 참여자, 성과 액션입니다.",
    permissions: [
      "program.create", "program.update", "program.archive",
      "program-session.create", "program-session.update",
      "participant.enroll", "participant.withdraw",
      "attendance.record", "attendance.update",
      "satisfaction-survey.create", "satisfaction-survey.update",
      "performance-eval.create", "performance-eval.update",
    ],
  },
  {
    key: "donation-volunteer",
    title: "후원/봉사 액션 권한",
    description: "후원자, 후원금, 자원봉사 액션입니다.",
    permissions: [
      "donor.create", "donor.update", "donor.archive",
      "donation.create", "donation.update", "donation.receipt",
      "in-kind-donation.create", "in-kind-donation.update", "in-kind-donation.distribute",
      "volunteer.create", "volunteer.update", "volunteer.archive",
      "volunteer-activity.create", "volunteer-activity.update",
      "volunteer-hours.record", "volunteer-hours.approve",
    ],
  },
  {
    key: "facility-hr",
    title: "시설/인사 액션 권한",
    description: "직원, 근태, 시설, 비품, 차량 액션입니다.",
    permissions: [
      "staff.create", "staff.update", "staff.archive",
      "attendance-hr.record", "attendance-hr.update", "attendance-hr.approve",
      "facility-room.create", "facility-room.update",
      "equipment.create", "equipment.update", "equipment.archive",
      "supply.create", "supply.update", "supply.distribute",
      "vehicle.create", "vehicle.update",
      "vehicle-schedule.create", "vehicle-schedule.update",
    ],
  },
  {
    key: "finance",
    title: "재무 액션 권한",
    description: "회계단위, 계정, AP/AR, 자산, 전표, 보조금 액션입니다.",
    permissions: [
      "subsidy.create", "subsidy.update", "subsidy.submit", "subsidy.approve",
      "accounting-unit.create", "accounting-unit.update",
      "accounting-unit.period-open", "accounting-unit.period-close", "accounting-unit.period-generate",
      "account.create", "account.update", "account.archive",
      "ap.create", "ap.approve", "ap.cancel-approval", "ap.pay", "ap.cancel-payment",
      "ar.create", "ar.issue", "ar.cancel-issue", "ar.collect", "ar.cancel-collection",
      "asset.create", "asset.update", "asset.archive", "asset.restore", "asset.depreciation-run",
      "journal-entry.create", "journal-entry.update", "journal-entry.submit", "journal-entry.post", "journal-entry.reverse",
    ],
  },
  {
    key: "work-support",
    title: "업무지원 액션 권한",
    description: "전자결재, 공람, 발급, 일정, 업무일지 액션입니다.",
    permissions: [
      "approval-doc.create", "approval-doc.approve", "approval-doc.reject",
      "circulation.create", "circulation.notify",
      "document-issue.create", "document-issue.update", "official-number.generate",
      "schedule.create", "schedule.update",
      "work-log.create", "work-log.submit",
    ],
  },
  {
    key: "workspace-admin",
    title: "협업/관리 액션 권한",
    description: "협업, 관리자 마스터 액션입니다.",
    permissions: [
      "workspace-post.create", "workspace-post.update", "workspace-post.request-review",
      "workspace-post.approve", "workspace-post.reject", "workspace-post.archive", "workspace-post.restore",
      "admin.user.create", "admin.user.update",
      "admin.org.create", "admin.org.update",
      "admin.role.create", "admin.role.update",
      "admin.policy.create", "admin.policy.update",
    ],
  },
  {
    key: "operations",
    title: "AI 운영 액션 권한",
    description: "이슈 관리, 직원 배정, 인수인계, 주간보고 액션입니다.",
    permissions: [
      "ops-issue.create", "ops-issue.update", "ops-issue.assign",
      "ops-staff.create", "ops-staff.update",
      "ops-handover.create", "ops-handover.update",
      "ops-report.generate",
    ],
  },
];

const actionRoutePermissions: Array<{
  pattern: RegExp;
  permission: ActionPermissionCode;
}> = [
  { pattern: /^\/client-case\/clients\/new$/, permission: "client.create" },
  { pattern: /^\/client-case\/clients\/[^/]+\/edit$/, permission: "client.update" },
  { pattern: /^\/client-case\/assessments\/new$/, permission: "needs-assessment.create" },
  { pattern: /^\/client-case\/assessments\/[^/]+\/edit$/, permission: "needs-assessment.update" },
  { pattern: /^\/client-case\/case-plans\/new$/, permission: "case-plan.create" },
  { pattern: /^\/client-case\/case-plans\/[^/]+\/edit$/, permission: "case-plan.update" },
  { pattern: /^\/client-case\/service-linkages\/new$/, permission: "service-linkage.create" },
  { pattern: /^\/client-case\/service-linkages\/[^/]+\/edit$/, permission: "service-linkage.update" },
  { pattern: /^\/client-case\/counseling\/new$/, permission: "counseling.create" },
  { pattern: /^\/client-case\/counseling\/[^/]+\/edit$/, permission: "counseling.update" },
  { pattern: /^\/client-case\/closures\/new$/, permission: "case-closure.create" },
  { pattern: /^\/programs\/new$/, permission: "program.create" },
  { pattern: /^\/programs\/[^/]+\/edit$/, permission: "program.update" },
  { pattern: /^\/programs\/[^/]+\/sessions\/new$/, permission: "program-session.create" },
  { pattern: /^\/programs\/[^/]+\/sessions\/[^/]+\/edit$/, permission: "program-session.update" },
  { pattern: /^\/donation-volunteer\/donors\/new$/, permission: "donor.create" },
  { pattern: /^\/donation-volunteer\/donors\/[^/]+\/edit$/, permission: "donor.update" },
  { pattern: /^\/donation-volunteer\/donations\/new$/, permission: "donation.create" },
  { pattern: /^\/donation-volunteer\/donations\/[^/]+\/edit$/, permission: "donation.update" },
  { pattern: /^\/donation-volunteer\/in-kind\/new$/, permission: "in-kind-donation.create" },
  { pattern: /^\/donation-volunteer\/in-kind\/[^/]+\/edit$/, permission: "in-kind-donation.update" },
  { pattern: /^\/donation-volunteer\/volunteers\/new$/, permission: "volunteer.create" },
  { pattern: /^\/donation-volunteer\/volunteers\/[^/]+\/edit$/, permission: "volunteer.update" },
  { pattern: /^\/donation-volunteer\/activities\/new$/, permission: "volunteer-activity.create" },
  { pattern: /^\/donation-volunteer\/activities\/[^/]+\/edit$/, permission: "volunteer-activity.update" },
  { pattern: /^\/facility-hr\/staff\/new$/, permission: "staff.create" },
  { pattern: /^\/facility-hr\/staff\/[^/]+\/edit$/, permission: "staff.update" },
  { pattern: /^\/facility-hr\/rooms\/new$/, permission: "facility-room.create" },
  { pattern: /^\/facility-hr\/rooms\/[^/]+\/edit$/, permission: "facility-room.update" },
  { pattern: /^\/facility-hr\/supplies\/new$/, permission: "supply.create" },
  { pattern: /^\/facility-hr\/supplies\/[^/]+\/edit$/, permission: "supply.update" },
  { pattern: /^\/facility-hr\/vehicles\/new$/, permission: "vehicle.create" },
  { pattern: /^\/facility-hr\/vehicles\/[^/]+\/edit$/, permission: "vehicle.update" },
  { pattern: /^\/finance\/accounting-units\/new$/, permission: "accounting-unit.create" },
  { pattern: /^\/finance\/accounts\/new$/, permission: "account.create" },
  { pattern: /^\/finance\/accounts\/[^/]+\/edit$/, permission: "account.update" },
  { pattern: /^\/finance\/ap\/new$/, permission: "ap.create" },
  { pattern: /^\/finance\/ar\/new$/, permission: "ar.create" },
  { pattern: /^\/finance\/assets\/new$/, permission: "asset.create" },
  { pattern: /^\/finance\/assets\/[^/]+\/edit$/, permission: "asset.update" },
  { pattern: /^\/finance\/journal-entries\/new$/, permission: "journal-entry.create" },
  { pattern: /^\/finance\/journal-entries\/[^/]+\/edit$/, permission: "journal-entry.update" },
  { pattern: /^\/finance\/subsidies\/new$/, permission: "subsidy.create" },
  { pattern: /^\/finance\/subsidies\/[^/]+\/edit$/, permission: "subsidy.update" },
  { pattern: /^\/approval\/new$/, permission: "approval-doc.create" },
  { pattern: /^\/circulation\/new$/, permission: "circulation.create" },
  { pattern: /^\/documents\/new$/, permission: "document-issue.create" },
  { pattern: /^\/documents\/[^/]+\/edit$/, permission: "document-issue.update" },
  { pattern: /^\/schedule\/new$/, permission: "schedule.create" },
  { pattern: /^\/schedule\/[^/]+\/edit$/, permission: "schedule.update" },
  { pattern: /^\/work-log\/new$/, permission: "work-log.create" },
  { pattern: /^\/operations\/issues\/new$/, permission: "ops-issue.create" },
  { pattern: /^\/operations\/issues\/[^/]+\/edit$/, permission: "ops-issue.update" },
  { pattern: /^\/operations\/handover\/new$/, permission: "ops-handover.create" },
];

export function getActionPermissionForPath(
  pathname: string,
  _searchParams?: URLSearchParams | null,
) {
  return actionRoutePermissions.find((item) => item.pattern.test(pathname))?.permission ?? null;
}
