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
        phase: "Team 1",
        permission: "dashboard.read",
      },
      {
        title: "사업개발",
        href: "/business-development",
        caption: "기회, 입찰, 계약",
        phase: "Team 2",
        permission: "business-development.read",
      },
      {
        title: "프로젝트",
        href: "/projects",
        caption: "현장, 유닛, 시스템, WBS",
        phase: "Team 2",
        permission: "project.read",
      },
      {
        title: "공급망",
        href: "/supply-chain",
        caption: "공급업체, 발주, 재고",
        phase: "Team 2",
        permission: "supply-chain.read",
      },
    ],
  },
  {
    title: "운영",
    items: [
      {
        title: "제작",
        href: "/manufacturing",
        caption: "모듈, 시리얼, 운송",
        phase: "Team 2",
        permission: "manufacturing.read",
      },
      {
        title: "품질",
        href: "/quality",
        caption: "ITP, 검사, NCR",
        phase: "Team 2",
        permission: "quality.read",
      },
      {
        title: "안전",
        href: "/safety",
        caption: "HSE, 사고, 현장 안전",
        phase: "Team 2",
        permission: "safety.read",
      },
      {
        title: "재무",
        href: "/finance",
        caption: "전표, AP/AR, 자산",
        phase: "Team 2",
        permission: "finance.read",
      },
      {
        title: "시운전",
        href: "/commissioning",
        caption: "패키지, Punch, Turnover",
        phase: "Team 2",
        permission: "commissioning.read",
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
        phase: "Team 1",
        permission: "admin.read",
      },
      {
        title: "협업",
        href: "/workspace",
        caption: "공지, 자료실, 승인함",
        phase: "Team 1",
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
  { prefix: "/business-development", permission: "business-development.read" },
  { prefix: "/projects", permission: "project.read" },
  { prefix: "/supply-chain", permission: "supply-chain.read" },
  { prefix: "/manufacturing", permission: "manufacturing.read" },
  { prefix: "/quality", permission: "quality.read" },
  { prefix: "/safety", permission: "safety.read" },
  { prefix: "/finance", permission: "finance.read" },
  { prefix: "/commissioning", permission: "commissioning.read" },
  { prefix: "/admin", permission: "admin.read" },
  { prefix: "/workspace", permission: "workspace.read" },
];

const searchableRouteItems: SearchableRouteItem[] = [
  {
    title: "사업기회",
    href: "/business-development/opportunities",
    caption: "사업개발 · 사업기회 목록",
    permission: "business-development.read",
  },
  {
    title: "계약",
    href: "/business-development/contracts",
    caption: "사업개발 · 계약 목록",
    permission: "business-development.read",
  },
  {
    title: "고객/거래처",
    href: "/business-development/parties",
    caption: "사업개발 · 고객/거래처 목록",
    permission: "business-development.read",
  },
  {
    title: "실행예산",
    href: "/projects/execution-budgets",
    caption: "프로젝트 · 실행예산 목록",
    permission: "project.read",
  },
  {
    title: "현장 목록",
    href: "/projects/sites",
    caption: "프로젝트 · 현장 목록",
    permission: "project.read",
  },
  {
    title: "WBS",
    href: "/projects/wbs",
    caption: "프로젝트 · WBS 목록",
    permission: "project.read",
  },
  {
    title: "공급업체",
    href: "/supply-chain/vendors",
    caption: "공급망 · 공급업체 목록",
    permission: "supply-chain.read",
  },
  {
    title: "자재",
    href: "/supply-chain/materials",
    caption: "공급망 · 자재 목록",
    permission: "supply-chain.read",
  },
  {
    title: "발주",
    href: "/supply-chain/purchase-orders",
    caption: "공급망 · 발주 목록",
    permission: "supply-chain.read",
  },
  {
    title: "재고",
    href: "/supply-chain/inventory",
    caption: "공급망 · 재고 현황",
    permission: "supply-chain.read",
  },
  {
    title: "모듈",
    href: "/manufacturing/modules",
    caption: "제작 · 모듈 목록",
    permission: "manufacturing.read",
  },
  {
    title: "제작 지시",
    href: "/manufacturing/orders",
    caption: "제작 · 제작 지시 목록",
    permission: "manufacturing.read",
  },
  {
    title: "운송",
    href: "/manufacturing/shipments",
    caption: "제작 · 운송 목록",
    permission: "manufacturing.read",
  },
  {
    title: "ITP",
    href: "/quality/itps",
    caption: "품질 · ITP 목록",
    permission: "quality.read",
  },
  {
    title: "검사",
    href: "/quality/inspections",
    caption: "품질 · 검사 목록",
    permission: "quality.read",
  },
  {
    title: "NCR",
    href: "/quality/ncr",
    caption: "품질 · NCR 목록",
    permission: "quality.read",
  },
  {
    title: "HSE",
    href: "/safety/hse",
    caption: "안전 · HSE 목록",
    permission: "safety.read",
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
  {
    title: "시운전 패키지",
    href: "/commissioning/packages",
    caption: "시운전 · 패키지 목록",
    permission: "commissioning.read",
  },
  {
    title: "규제 대응",
    href: "/commissioning/regulatory",
    caption: "시운전 · 규제 대응 목록",
    permission: "commissioning.read",
  },
];

export const mockProfiles: Record<AppRole, ViewerProfile> = {
  platform_admin: {
    role: "platform_admin",
    displayName: "Platform Admin",
    orgUnitName: "ERP Platform",
    email: "platform.admin@smr.local",
    permissions: [
      "dashboard.read",
      "business-development.read",
      "business-development.write",
      "project.read",
      "project.write",
      "supply-chain.read",
      "supply-chain.write",
      "manufacturing.read",
      "manufacturing.write",
      "quality.read",
      "quality.write",
      "safety.read",
      "safety.write",
      "finance.read",
      "finance.write",
      "commissioning.read",
      "commissioning.write",
      "admin.read",
      "admin.write",
      "workspace.read",
      "workspace.write",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/dashboard", "/projects", "/admin"],
    recent: ["/projects", "/workspace", "/dashboard"],
    savedViews: [
      {
        id: "view-platform-1",
        title: "플랫폼 운영판",
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
        title: "실무 조회 뷰",
        href: "/projects",
        description: "관리자 관점에서 프로젝트와 도메인 진행 현황 확인",
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
        title: "공통 UI freeze 준비",
        body: "AppShell, DataTable, FormSection v1 고정이 필요합니다.",
        tone: "info",
      },
    ],
  },
  domain_lead: {
    role: "domain_lead",
    displayName: "Domain Lead",
    orgUnitName: "Business Delivery",
    email: "domain.lead@smr.local",
    permissions: [
      "dashboard.read",
      "business-development.read",
      "business-development.write",
      "project.read",
      "project.write",
      "supply-chain.read",
      "supply-chain.write",
      "manufacturing.read",
      "manufacturing.write",
      "quality.read",
      "quality.write",
      "safety.read",
      "safety.write",
      "finance.read",
      "finance.write",
      "commissioning.read",
      "commissioning.write",
      "workspace.read",
      "workspace.write",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/projects", "/quality", "/finance"],
    recent: ["/projects", "/business-development", "/quality"],
    savedViews: [
      {
        id: "view-domain-1",
        title: "프로젝트 실행 뷰",
        href: "/projects",
        description: "프로젝트, 실행예산, 상태 흐름",
      },
      {
        id: "view-domain-2",
        title: "품질/NCR 집중",
        href: "/quality",
        description: "오픈 NCR, 검사, CAPA 확인",
      },
    ],
    notifications: [
      {
        id: "domain-1",
        title: "프로젝트 모듈 placeholder",
        body: "Team 2가 목록/상세/등록 흐름을 연결할 준비가 되었습니다.",
        tone: "success",
      },
      {
        id: "domain-2",
        title: "재무 모듈 Phase 4 예정",
        body: "전표와 AP/AR 상태 전이 정의를 미리 정리하세요.",
        tone: "info",
      },
    ],
  },
  executive: {
    role: "executive",
    displayName: "Executive Viewer",
    orgUnitName: "Executive Office",
    email: "executive@smr.local",
    permissions: [
      "dashboard.read",
      "business-development.read",
      "project.read",
      "supply-chain.read",
      "manufacturing.read",
      "quality.read",
      "safety.read",
      "finance.read",
      "commissioning.read",
      "admin.read",
      "workspace.read",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ],
    favorites: ["/dashboard", "/projects", "/finance"],
    recent: ["/dashboard", "/projects", "/workspace"],
    savedViews: [
      {
        id: "view-exec-1",
        title: "포트폴리오 요약",
        href: "/dashboard",
        description: "프로젝트, 승인, 리스크 요약",
      },
      {
        id: "view-exec-2",
        title: "프로젝트 실행 요약",
        href: "/projects",
        description: "프로젝트, 실행예산, 주요 리스크 조회",
      },
      {
        id: "view-exec-3",
        title: "재무/원가 브리프",
        href: "/finance",
        description: "전표, AP/AR, 자산 현황을 읽기 전용으로 확인",
      },
    ],
    notifications: [
      {
        id: "exec-1",
        title: "포트폴리오 현황 업데이트",
        body: "프로젝트 진행도와 오픈 NCR 수치를 확인하세요.",
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
    title: "운영 관리자",
    description: "관리자, 협업, 공통 UI, 권한 메타데이터를 확인하는 개발용 우회 권한.",
  },
  {
    role: "domain_lead",
    title: "업무 담당자",
    description: "도메인 모듈, 상태 흐름, CRUD 검증을 확인하는 개발용 우회 권한.",
  },
  {
    role: "executive",
    title: "경영진 조회",
    description: "전 영역을 읽기 전용으로 확인하고 수정 API는 차단하는 개발용 우회 권한.",
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
      { label: "공통 UI", value: "Phase 1", tone: "info" as const },
      { label: "권한/메뉴", value: "Phase 2", tone: "warning" as const },
      { label: "Admin/Workspace", value: "Phase 3", tone: "success" as const },
    ];
  }

  if (role === "domain_lead") {
    return [
      { label: "사업/프로젝트", value: "Phase 2", tone: "info" as const },
      { label: "운영 모듈", value: "Phase 3", tone: "warning" as const },
      { label: "재무/시운전", value: "Phase 4", tone: "success" as const },
    ];
  }

  return [
    { label: "현황판", value: "Live", tone: "success" as const },
    { label: "협업", value: "Workspace", tone: "info" as const },
  ];
}
