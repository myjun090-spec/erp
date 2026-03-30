import {
  actionPermissionCatalog,
  actionPermissionMetadataMap,
  allPermissionCatalog,
  expandPermissionCodes,
  getActionPermissionForPath,
  getPermissionMetadata,
  permissionSelectionGroups,
  permissionCatalog,
  permissionMetadataMap,
  type KnownPermissionCode,
  type PermissionCode,
} from "@/lib/permission-catalog";

export type AppRole = "platform_admin" | "domain_lead" | "executive";
export {
  actionPermissionCatalog,
  actionPermissionMetadataMap,
  allPermissionCatalog,
  getPermissionMetadata,
  permissionCatalog,
  permissionMetadataMap,
  permissionSelectionGroups,
};
export type { ActionPermissionCode, KnownPermissionCode, PermissionCode } from "@/lib/permission-catalog";

export type NavigationItem = {
  title: string;
  href: string;
  caption: string;
  phase: string;
  permission: PermissionCode;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

type SearchableRouteItem = {
  title: string;
  href: string;
  caption: string;
  permission: PermissionCode;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "success";
};

export type SavedViewItem = {
  id: string;
  title: string;
  href: string;
  description: string;
};

export type ViewerProfile = {
  role: AppRole;
  displayName: string;
  orgUnitName: string;
  email: string;
  permissions: KnownPermissionCode[];
  favorites: string[];
  recent: string[];
  savedViews: SavedViewItem[];
  notifications: NotificationItem[];
};

export const roleCookieName = "erp_role";

export const navigationGroups: NavigationGroup[] = [
  {
    title: "핵심",
    items: [
      {
        title: "대시보드",
        href: "/dashboard",
        caption: "현황판과 KPI",
        phase: "Phase 1",
        permission: "dashboard.read",
      },
      {
        title: "이용자/사례",
        href: "/client-case",
        caption: "이용자, 욕구사정, 사례관리",
        phase: "Phase 1",
        permission: "client-case.read",
      },
      {
        title: "프로그램",
        href: "/programs",
        caption: "프로그램 기획, 운영, 성과",
        phase: "Phase 1",
        permission: "program.read",
      },
      {
        title: "일정관리",
        href: "/schedule",
        caption: "캘린더, 일정 등록",
        phase: "Phase 1",
        permission: "schedule.read",
      },
    ],
  },
  {
    title: "업무지원",
    items: [
      {
        title: "전자결재",
        href: "/approval",
        caption: "기안, 결재, 문서함",
        phase: "Phase 2",
        permission: "approval.read",
      },
      {
        title: "공람함",
        href: "/circulation",
        caption: "문서 공람, 열람 현황",
        phase: "Phase 2",
        permission: "circulation.read",
      },
      {
        title: "발급/기안",
        href: "/documents",
        caption: "문서 발급, 공문번호",
        phase: "Phase 2",
        permission: "document.read",
      },
      {
        title: "업무일지",
        href: "/work-log",
        caption: "주간실적보고, 업무기록",
        phase: "Phase 2",
        permission: "work-log.read",
      },
    ],
  },
  {
    title: "자원관리",
    items: [
      {
        title: "후원/봉사",
        href: "/donation-volunteer",
        caption: "후원자, 후원금, 자원봉사",
        phase: "Phase 2",
        permission: "donation-volunteer.read",
      },
      {
        title: "시설/인사",
        href: "/facility-hr",
        caption: "직원, 근태, 시설, 비품, 차량",
        phase: "Phase 2",
        permission: "facility-hr.read",
      },
      {
        title: "재무",
        href: "/finance",
        caption: "전표, AP/AR, 자산, 보조금",
        phase: "Phase 2",
        permission: "finance.read",
      },
    ],
  },
  {
    title: "AI 운영",
    items: [
      {
        title: "운영관리",
        href: "/operations",
        caption: "이슈, 배정, 인수인계, 보드, 보고서",
        phase: "Phase 3",
        permission: "operations.read",
      },
    ],
  },
  {
    title: "분석",
    items: [
      {
        title: "통계",
        href: "/statistics",
        caption: "이용자, 사례, 재무 통계",
        phase: "Phase 3",
        permission: "statistics.read",
      },
      {
        title: "AI 도우미",
        href: "/ai-assistant",
        caption: "AI 기반 업무 지원",
        phase: "Phase 3",
        permission: "dashboard.read",
      },
    ],
  },
  {
    title: "연계",
    items: [
      {
        title: "정부시스템",
        href: "/integration",
        caption: "사회보장정보원, 행복e음",
        phase: "Phase 3",
        permission: "admin.read",
      },
      {
        title: "구글협업",
        href: "/google-collab",
        caption: "구글 워크스페이스 연동",
        phase: "Phase 3",
        permission: "workspace.read",
      },
      {
        title: "법령검색(법제처)",
        href: "/law-search/external",
        caption: "법제처 Open API 법령 검색",
        phase: "Phase 3",
        permission: "dashboard.read",
      },
      {
        title: "우편번호",
        href: "/zipcode",
        caption: "도로명주소 우편번호 검색",
        phase: "Phase 3",
        permission: "dashboard.read",
      },
    ],
  },
  {
    title: "업무도구",
    items: [
      {
        title: "문서파싱",
        href: "/document-parse",
        caption: "HWP/PDF 문서 텍스트 추출",
        phase: "Phase 3",
        permission: "document.read",
      },
    ],
  },
  {
    title: "관리",
    items: [
      {
        title: "관리자",
        href: "/admin",
        caption: "사용자, 조직, 권한",
        phase: "Phase 1",
        permission: "admin.read",
      },
      {
        title: "협업",
        href: "/workspace",
        caption: "공지, 자료실, 승인함",
        phase: "Phase 1",
        permission: "workspace.read",
      },
    ],
  },
];

export const routePermissions: Array<{
  prefix: string;
  permission: PermissionCode;
}> = [
  { prefix: "/dashboard", permission: "dashboard.read" },
  { prefix: "/client-case", permission: "client-case.read" },
  { prefix: "/programs", permission: "program.read" },
  { prefix: "/schedule", permission: "schedule.read" },
  { prefix: "/approval", permission: "approval.read" },
  { prefix: "/circulation", permission: "circulation.read" },
  { prefix: "/documents", permission: "document.read" },
  { prefix: "/work-log", permission: "work-log.read" },
  { prefix: "/donation-volunteer", permission: "donation-volunteer.read" },
  { prefix: "/facility-hr", permission: "facility-hr.read" },
  { prefix: "/finance", permission: "finance.read" },
  { prefix: "/statistics", permission: "statistics.read" },
  { prefix: "/operations", permission: "operations.read" },
  { prefix: "/ai-assistant", permission: "dashboard.read" },
  { prefix: "/integration", permission: "admin.read" },
  { prefix: "/google-collab", permission: "workspace.read" },
  { prefix: "/law-search/external", permission: "dashboard.read" },
  { prefix: "/zipcode", permission: "dashboard.read" },
  { prefix: "/document-parse", permission: "document.read" },
  { prefix: "/admin", permission: "admin.read" },
  { prefix: "/workspace", permission: "workspace.read" },
];

const searchableRouteItems: SearchableRouteItem[] = [
  // 이용자/사례
  {
    title: "이용자",
    href: "/client-case/clients",
    caption: "이용자/사례 · 이용자 목록",
    permission: "client-case.read",
  },
  {
    title: "욕구사정",
    href: "/client-case/assessments",
    caption: "이용자/사례 · 욕구사정 목록",
    permission: "client-case.read",
  },
  {
    title: "사례계획",
    href: "/client-case/case-plans",
    caption: "이용자/사례 · 사례계획 목록",
    permission: "client-case.read",
  },
  {
    title: "서비스연계",
    href: "/client-case/service-linkages",
    caption: "이용자/사례 · 서비스연계 목록",
    permission: "client-case.read",
  },
  {
    title: "상담기록",
    href: "/client-case/counseling",
    caption: "이용자/사례 · 상담기록 목록",
    permission: "client-case.read",
  },
  {
    title: "사례종결",
    href: "/client-case/closures",
    caption: "이용자/사례 · 사례종결 목록",
    permission: "client-case.read",
  },

  // 프로그램
  {
    title: "프로그램",
    href: "/programs",
    caption: "프로그램 · 프로그램 목록",
    permission: "program.read",
  },
  {
    title: "세션",
    href: "/programs/sessions",
    caption: "프로그램 · 세션(회차) 목록",
    permission: "program.read",
  },
  {
    title: "참여자",
    href: "/programs/participants",
    caption: "프로그램 · 참여자 목록",
    permission: "program.read",
  },
  {
    title: "만족도",
    href: "/programs/satisfaction",
    caption: "프로그램 · 만족도조사 목록",
    permission: "program.read",
  },
  {
    title: "성과평가",
    href: "/programs/evaluations",
    caption: "프로그램 · 성과평가 목록",
    permission: "program.read",
  },

  // 후원/봉사
  {
    title: "후원자",
    href: "/donation-volunteer/donors",
    caption: "후원/봉사 · 후원자 목록",
    permission: "donation-volunteer.read",
  },
  {
    title: "후원금",
    href: "/donation-volunteer/donations",
    caption: "후원/봉사 · 후원금 목록",
    permission: "donation-volunteer.read",
  },
  {
    title: "후원물품",
    href: "/donation-volunteer/in-kind",
    caption: "후원/봉사 · 후원물품 목록",
    permission: "donation-volunteer.read",
  },
  {
    title: "봉사자",
    href: "/donation-volunteer/volunteers",
    caption: "후원/봉사 · 봉사자 목록",
    permission: "donation-volunteer.read",
  },
  {
    title: "봉사활동",
    href: "/donation-volunteer/activities",
    caption: "후원/봉사 · 봉사활동 목록",
    permission: "donation-volunteer.read",
  },
  {
    title: "봉사시간",
    href: "/donation-volunteer/hours",
    caption: "후원/봉사 · 봉사시간 현황",
    permission: "donation-volunteer.read",
  },

  // 시설/인사
  {
    title: "직원",
    href: "/facility-hr/staff",
    caption: "시설/인사 · 직원 목록",
    permission: "facility-hr.read",
  },
  {
    title: "근태",
    href: "/facility-hr/attendance",
    caption: "시설/인사 · 근태 현황",
    permission: "facility-hr.read",
  },
  {
    title: "시설",
    href: "/facility-hr/rooms",
    caption: "시설/인사 · 시설공간 목록",
    permission: "facility-hr.read",
  },
  {
    title: "비품",
    href: "/facility-hr/equipment",
    caption: "시설/인사 · 비품 목록",
    permission: "facility-hr.read",
  },
  {
    title: "소모품",
    href: "/facility-hr/supplies",
    caption: "시설/인사 · 소모품 목록",
    permission: "facility-hr.read",
  },
  {
    title: "차량",
    href: "/facility-hr/vehicles",
    caption: "시설/인사 · 차량 관리",
    permission: "facility-hr.read",
  },

  // 재무
  {
    title: "보조금",
    href: "/finance/subsidies",
    caption: "재무 · 보조금 목록",
    permission: "finance.read",
  },
  {
    title: "회계 단위",
    href: "/finance/accounting-units",
    caption: "재무 · 회계 단위 목록",
    permission: "finance.read",
  },
  {
    title: "계정과목",
    href: "/finance/accounts",
    caption: "재무 · 계정과목 목록",
    permission: "finance.read",
  },
  {
    title: "전표",
    href: "/finance/journal-entries",
    caption: "재무 · 전표 목록",
    permission: "finance.read",
  },
  {
    title: "매입채무",
    href: "/finance/ap",
    caption: "재무 · AP 목록",
    permission: "finance.read",
  },
  {
    title: "매출채권",
    href: "/finance/ar",
    caption: "재무 · AR 목록",
    permission: "finance.read",
  },
  {
    title: "자산",
    href: "/finance/assets",
    caption: "재무 · 자산 목록",
    permission: "finance.read",
  },

  // 업무지원
  {
    title: "전자결재",
    href: "/approval",
    caption: "업무지원 · 전자결재 문서함",
    permission: "approval.read",
  },
  {
    title: "공람함",
    href: "/circulation",
    caption: "업무지원 · 공람 문서 목록",
    permission: "circulation.read",
  },
  {
    title: "발급/기안",
    href: "/documents",
    caption: "업무지원 · 문서 발급 목록",
    permission: "document.read",
  },
  {
    title: "일정관리",
    href: "/schedule",
    caption: "업무지원 · 캘린더/일정",
    permission: "schedule.read",
  },
  {
    title: "업무일지",
    href: "/work-log",
    caption: "업무지원 · 주간실적보고",
    permission: "work-log.read",
  },

  // AI 운영
  {
    title: "이슈관리",
    href: "/operations/issues",
    caption: "AI 운영 · 이슈 접수/분석",
    permission: "operations.read",
  },
  {
    title: "직원배정",
    href: "/operations/assignment",
    caption: "AI 운영 · AI 자동 배정",
    permission: "operations.read",
  },
  {
    title: "인수인계",
    href: "/operations/handover",
    caption: "AI 운영 · 근무 인수인계",
    permission: "operations.read",
  },
  {
    title: "운영보드",
    href: "/operations/board",
    caption: "AI 운영 · 실시간 운영 피드",
    permission: "operations.read",
  },
  {
    title: "주간보고",
    href: "/operations/report",
    caption: "AI 운영 · AI 주간 운영 보고서",
    permission: "operations.read",
  },

  // 분석
  {
    title: "통계",
    href: "/statistics",
    caption: "분석 · 이용자/사례/재무 통계",
    permission: "statistics.read",
  },

  // 연계/도구
  {
    title: "법령검색(법제처)",
    href: "/law-search/external",
    caption: "연계 · 법제처 Open API 법령 검색",
    permission: "dashboard.read",
  },
  {
    title: "우편번호",
    href: "/zipcode",
    caption: "연계 · 도로명주소 우편번호 검색",
    permission: "dashboard.read",
  },
  {
    title: "문서파싱",
    href: "/document-parse",
    caption: "업무도구 · HWP/PDF 텍스트 추출",
    permission: "document.read",
  },

  // 관리
  {
    title: "관리자",
    href: "/admin",
    caption: "관리 · 사용자, 조직, 권한",
    permission: "admin.read",
  },
  {
    title: "협업",
    href: "/workspace",
    caption: "관리 · 공지, 자료실, 승인함",
    permission: "workspace.read",
  },
];

export const mockProfiles: Record<AppRole, ViewerProfile> = {
  platform_admin: {
    role: "platform_admin",
    displayName: "시스템 관리자",
    orgUnitName: "정보기술팀",
    email: "sysadmin@welfare.local",
    permissions: [
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
      "operations.read",
      "operations.write",
      "admin.read",
      "admin.write",
      "workspace.read",
      "workspace.write",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/dashboard", "/admin", "/client-case"],
    recent: ["/admin", "/dashboard", "/workspace"],
    savedViews: [
      {
        id: "view-platform-1",
        title: "시스템 운영판",
        href: "/dashboard",
        description: "관리/협업/현황판 위젯 묶음",
      },
      {
        id: "view-platform-2",
        title: "권한 운영 뷰",
        href: "/admin",
        description: "사용자, 정책, 감사 로그 집중 보기",
      },
      {
        id: "view-platform-3",
        title: "전체 사례 조회 뷰",
        href: "/client-case",
        description: "관리자 관점에서 이용자/사례 현황 확인",
      },
    ],
    notifications: [
      {
        id: "platform-1",
        title: "권한 메타데이터 검토",
        body: "route registry와 permission 코드 매핑을 점검하세요.",
        tone: "warning",
      },
      {
        id: "platform-2",
        title: "시스템 정기 점검",
        body: "백업 상태와 연계 시스템 접속을 확인하세요.",
        tone: "info",
      },
    ],
  },
  domain_lead: {
    role: "domain_lead",
    displayName: "시설장",
    orgUnitName: "사회복지관",
    email: "director@welfare.local",
    permissions: [
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
      "operations.read",
      "operations.write",
      "workspace.read",
      "workspace.write",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/dashboard", "/client-case", "/finance"],
    recent: ["/client-case", "/programs", "/approval"],
    savedViews: [
      {
        id: "view-domain-1",
        title: "사례관리 현황 뷰",
        href: "/client-case",
        description: "이용자, 욕구사정, 사례계획 현황",
      },
      {
        id: "view-domain-2",
        title: "프로그램 운영 뷰",
        href: "/programs",
        description: "프로그램 진행률, 참여자, 만족도 확인",
      },
    ],
    notifications: [
      {
        id: "domain-1",
        title: "결재 대기 문서 확인",
        body: "승인 대기 중인 사례계획 3건이 있습니다.",
        tone: "warning",
      },
      {
        id: "domain-2",
        title: "보조금 정산 기한 안내",
        body: "이번 분기 보조금 정산 마감이 다가옵니다.",
        tone: "info",
      },
    ],
  },
  executive: {
    role: "executive",
    displayName: "이사",
    orgUnitName: "이사회",
    email: "board@welfare.local",
    permissions: [
      "dashboard.read",
      "client-case.read",
      "program.read",
      "donation-volunteer.read",
      "facility-hr.read",
      "finance.read",
      "approval.read",
      "circulation.read",
      "document.read",
      "schedule.read",
      "work-log.read",
      "statistics.read",
      "operations.read",
      "admin.read",
      "workspace.read",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/dashboard", "/statistics", "/finance"],
    recent: ["/dashboard", "/statistics", "/client-case"],
    savedViews: [
      {
        id: "view-exec-1",
        title: "기관 현황 요약",
        href: "/dashboard",
        description: "이용자, 프로그램, 후원, 재무 요약",
      },
      {
        id: "view-exec-2",
        title: "사례관리 실적 요약",
        href: "/statistics",
        description: "이용자 추이, 사례종결률, 서비스연계 현황",
      },
      {
        id: "view-exec-3",
        title: "재무/보조금 브리프",
        href: "/finance",
        description: "전표, 보조금 집행, 후원금 현황을 읽기 전용으로 확인",
      },
    ],
    notifications: [
      {
        id: "exec-1",
        title: "기관 운영 현황 업데이트",
        body: "이용자 추이와 프로그램 성과를 확인하세요.",
        tone: "info",
      },
    ],
  },
};

export const loginRoleCards: Array<{
  role: AppRole;
  title: string;
  description: string;
}> = [
  {
    role: "platform_admin",
    title: "시스템 관리자",
    description: "사용자, 조직, 권한 관리와 시스템 전체 설정을 담당하는 관리자 권한.",
  },
  {
    role: "domain_lead",
    title: "시설장",
    description: "이용자/사례, 프로그램, 후원/봉사, 재무 등 기관 전체 업무를 총괄하는 시설장 권한.",
  },
  {
    role: "executive",
    title: "이사 (읽기 전용)",
    description: "전 영역을 읽기 전용으로 조회하며 경영 의사결정을 지원하는 이사 권한.",
  },
];

export function isAppRole(value: string | undefined | null): value is AppRole {
  return value === "platform_admin" || value === "domain_lead" || value === "executive";
}

export function buildViewerProfile(
  role: AppRole,
  overrides?: Partial<Pick<ViewerProfile, "displayName" | "orgUnitName" | "email" | "permissions">>,
) {
  const mergedPermissions = expandPermissionCodes(
    overrides?.permissions ?? mockProfiles[role].permissions,
  ) as KnownPermissionCode[];

  return {
    ...mockProfiles[role],
    ...overrides,
    permissions: mergedPermissions,
  };
}

export function hasPermission(
  permissions: ReadonlyArray<string>,
  required: string,
) {
  return permissions.includes(required);
}

export function canAccessAction(
  permissions: ReadonlyArray<string>,
  required: string | null | undefined,
) {
  if (!required) {
    return true;
  }

  return hasPermission(permissions, required);
}

export function canAccessAnyAction(
  permissions: ReadonlyArray<string>,
  requiredPermissions: ReadonlyArray<string>,
) {
  return requiredPermissions.some((requiredPermission) =>
    canAccessAction(permissions, requiredPermission),
  );
}

function parsePathInput(path: string) {
  try {
    const url = new URL(path, "http://localhost");
    return {
      pathname: url.pathname,
      searchParams: url.searchParams,
    };
  } catch {
    const [pathname, search = ""] = path.split("?");
    return {
      pathname,
      searchParams: new URLSearchParams(search),
    };
  }
}

export function getRequiredPermissionForPath(path: string) {
  const { pathname, searchParams } = parsePathInput(path);
  const actionPermission = getActionPermissionForPath(pathname, searchParams);

  if (actionPermission) {
    return actionPermission;
  }

  const match = [...routePermissions]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));

  return match?.permission ?? null;
}

export function canAccessHref(
  permissions: ReadonlyArray<string>,
  href: string,
) {
  return canAccessAction(permissions, getRequiredPermissionForPath(href));
}

export function getNavigationByPermissions(permissions: ReadonlyArray<string>) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(permissions, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getAccessibleItems(permissions: ReadonlyArray<string>) {
  return getNavigationByPermissions(permissions).flatMap((group) => group.items);
}

export function getSearchableRouteItems(permissions: ReadonlyArray<string>) {
  return searchableRouteItems
    .filter((item) => hasPermission(permissions, item.permission))
    .map(({ title, href, caption }) => ({ title, href, caption }));
}

export function getFavoriteItems(profile: ViewerProfile) {
  const accessible = getAccessibleItems(profile.permissions);
  return accessible.filter((item) => profile.favorites.includes(item.href));
}

export function getRecentItems(profile: ViewerProfile) {
  const accessible = getAccessibleItems(profile.permissions);
  return accessible.filter((item) => profile.recent.includes(item.href));
}

export function getSavedViews(profile: ViewerProfile) {
  return profile.savedViews;
}

export function getTeamProgress(role: AppRole) {
  if (role === "platform_admin") {
    return [
      { label: "시스템 설정", value: "운영 중", tone: "success" as const },
      { label: "권한/메뉴", value: "운영 중", tone: "success" as const },
      { label: "연계 시스템", value: "구축 중", tone: "warning" as const },
    ];
  }

  if (role === "domain_lead") {
    return [
      { label: "이용자/사례", value: "운영 중", tone: "success" as const },
      { label: "프로그램/후원", value: "운영 중", tone: "success" as const },
      { label: "재무/보조금", value: "운영 중", tone: "info" as const },
    ];
  }

  return [
    { label: "현황판", value: "운영 중", tone: "success" as const },
    { label: "통계/분석", value: "조회 가능", tone: "info" as const },
  ];
}
