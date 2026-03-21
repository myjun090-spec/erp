export type PermissionCode =
  | "dashboard.read"
  | "business-development.read"
  | "business-development.write"
  | "project.read"
  | "project.write"
  | "supply-chain.read"
  | "supply-chain.write"
  | "manufacturing.read"
  | "manufacturing.write"
  | "quality.read"
  | "quality.write"
  | "safety.read"
  | "safety.write"
  | "finance.read"
  | "finance.write"
  | "commissioning.read"
  | "commissioning.write"
  | "admin.read"
  | "admin.write"
  | "workspace.read"
  | "workspace.write"
  | "navigation.search"
  | "notifications.read"
  | "personalization.read";

export type ActionPermissionCode =
  | "party.create"
  | "party.update"
  | "party.archive"
  | "contract.create"
  | "contract.update"
  | "contract.approve"
  | "contract.archive"
  | "opportunity.create"
  | "opportunity.update"
  | "opportunity.archive"
  | "project.create"
  | "project.update"
  | "project.archive"
  | "site.create"
  | "site.update"
  | "unit.create"
  | "unit.update"
  | "system.create"
  | "system.update"
  | "wbs.create"
  | "wbs.update"
  | "wbs.archive"
  | "execution-budget.create"
  | "execution-budget.update"
  | "execution-budget.approve"
  | "vendor.create"
  | "vendor.update"
  | "vendor.archive"
  | "material.create"
  | "material.update"
  | "material.archive"
  | "purchase-order.create"
  | "purchase-order.update"
  | "purchase-order.submit"
  | "purchase-order.approve"
  | "purchase-order.reject"
  | "purchase-order.cancel-approval"
  | "purchase-order.receive"
  | "purchase-order.cancel-receipt"
  | "inventory.receipt"
  | "inventory.issue"
  | "inventory.transfer"
  | "inventory.adjust-request"
  | "inventory.adjust-approve"
  | "inventory.adjust-reject"
  | "module.create"
  | "module.update"
  | "manufacturing-order.create"
  | "manufacturing-order.update"
  | "shipment.create"
  | "shipment.update"
  | "shipment.approve"
  | "itp.create"
  | "itp.update"
  | "inspection.create"
  | "inspection.update"
  | "inspection.archive"
  | "ncr.create"
  | "ncr.update"
  | "ncr.archive"
  | "hse.create"
  | "hse.update"
  | "hse.archive"
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
  | "commissioning-package.create"
  | "commissioning-package.update"
  | "commissioning-package.approve"
  | "regulatory-action.create"
  | "regulatory-action.update"
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
  | "admin.policy.update";

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
];

export const permissionMetadataMap: Record<PermissionCode, PermissionMetadata> = {
  "dashboard.read": {
    label: "대시보드 조회",
    description: "현황판과 KPI를 조회합니다.",
    domain: "공통",
  },
  "business-development.read": {
    label: "사업개발 조회",
    description: "기회, 계약, 고객 정보를 조회합니다.",
    domain: "사업개발",
  },
  "business-development.write": {
    label: "사업개발 변경",
    description: "사업개발 도메인 전체 변경 권한입니다.",
    domain: "사업개발",
  },
  "project.read": {
    label: "프로젝트 조회",
    description: "프로젝트, 유닛, WBS를 조회합니다.",
    domain: "프로젝트",
  },
  "project.write": {
    label: "프로젝트 변경",
    description: "프로젝트 도메인 전체 변경 권한입니다.",
    domain: "프로젝트",
  },
  "supply-chain.read": {
    label: "공급망 조회",
    description: "공급업체, 자재, 발주, 재고를 조회합니다.",
    domain: "공급망",
  },
  "supply-chain.write": {
    label: "공급망 변경",
    description: "공급망 도메인 전체 변경 권한입니다.",
    domain: "공급망",
  },
  "manufacturing.read": {
    label: "제작 조회",
    description: "모듈, 제작, 운송 정보를 조회합니다.",
    domain: "제작",
  },
  "manufacturing.write": {
    label: "제작 변경",
    description: "제작 도메인 전체 변경 권한입니다.",
    domain: "제작",
  },
  "quality.read": {
    label: "품질 조회",
    description: "검사, NCR, ITP를 조회합니다.",
    domain: "품질",
  },
  "quality.write": {
    label: "품질 변경",
    description: "품질 도메인 전체 변경 권한입니다.",
    domain: "품질",
  },
  "safety.read": {
    label: "안전 조회",
    description: "HSE 사고와 안전 현황을 조회합니다.",
    domain: "안전",
  },
  "safety.write": {
    label: "안전 변경",
    description: "안전 도메인 전체 변경 권한입니다.",
    domain: "안전",
  },
  "finance.read": {
    label: "재무 조회",
    description: "전표, AP/AR, 자산을 조회합니다.",
    domain: "재무",
  },
  "finance.write": {
    label: "재무 변경",
    description: "재무 도메인 전체 변경 권한입니다.",
    domain: "재무",
  },
  "commissioning.read": {
    label: "시운전 조회",
    description: "패키지와 규제 대응 정보를 조회합니다.",
    domain: "시운전",
  },
  "commissioning.write": {
    label: "시운전 변경",
    description: "시운전 도메인 전체 변경 권한입니다.",
    domain: "시운전",
  },
  "admin.read": {
    label: "관리자 조회",
    description: "사용자, 조직, 역할, 정책을 조회합니다.",
    domain: "관리",
  },
  "admin.write": {
    label: "관리자 변경",
    description: "관리자 도메인 전체 변경 권한입니다.",
    domain: "관리",
  },
  "workspace.read": {
    label: "협업 조회",
    description: "공지, 자료실, 승인함을 조회합니다.",
    domain: "협업",
  },
  "workspace.write": {
    label: "협업 변경",
    description: "협업 도메인 전체 변경 권한입니다.",
    domain: "협업",
  },
  "navigation.search": {
    label: "전역 검색",
    description: "메뉴와 저장 뷰를 검색합니다.",
    domain: "공통",
  },
  "notifications.read": {
    label: "알림 조회",
    description: "개인 알림과 운영 알림을 확인합니다.",
    domain: "공통",
  },
  "personalization.read": {
    label: "개인화 조회",
    description: "저장 뷰와 개인 설정을 사용합니다.",
    domain: "공통",
  },
};

export const actionPermissionCatalog: ActionPermissionCode[] = [
  "party.create",
  "party.update",
  "party.archive",
  "contract.create",
  "contract.update",
  "contract.approve",
  "contract.archive",
  "opportunity.create",
  "opportunity.update",
  "opportunity.archive",
  "project.create",
  "project.update",
  "project.archive",
  "site.create",
  "site.update",
  "unit.create",
  "unit.update",
  "system.create",
  "system.update",
  "wbs.create",
  "wbs.update",
  "wbs.archive",
  "execution-budget.create",
  "execution-budget.update",
  "execution-budget.approve",
  "vendor.create",
  "vendor.update",
  "vendor.archive",
  "material.create",
  "material.update",
  "material.archive",
  "purchase-order.create",
  "purchase-order.update",
  "purchase-order.submit",
  "purchase-order.approve",
  "purchase-order.reject",
  "purchase-order.cancel-approval",
  "purchase-order.receive",
  "purchase-order.cancel-receipt",
  "inventory.receipt",
  "inventory.issue",
  "inventory.transfer",
  "inventory.adjust-request",
  "inventory.adjust-approve",
  "inventory.adjust-reject",
  "module.create",
  "module.update",
  "manufacturing-order.create",
  "manufacturing-order.update",
  "shipment.create",
  "shipment.update",
  "shipment.approve",
  "itp.create",
  "itp.update",
  "inspection.create",
  "inspection.update",
  "inspection.archive",
  "ncr.create",
  "ncr.update",
  "ncr.archive",
  "hse.create",
  "hse.update",
  "hse.archive",
  "accounting-unit.create",
  "accounting-unit.update",
  "accounting-unit.period-open",
  "accounting-unit.period-close",
  "accounting-unit.period-generate",
  "account.create",
  "account.update",
  "account.archive",
  "ap.create",
  "ap.approve",
  "ap.cancel-approval",
  "ap.pay",
  "ap.cancel-payment",
  "ar.create",
  "ar.issue",
  "ar.cancel-issue",
  "ar.collect",
  "ar.cancel-collection",
  "asset.create",
  "asset.update",
  "asset.archive",
  "asset.restore",
  "asset.depreciation-run",
  "journal-entry.create",
  "journal-entry.update",
  "journal-entry.submit",
  "journal-entry.post",
  "journal-entry.reverse",
  "commissioning-package.create",
  "commissioning-package.update",
  "commissioning-package.approve",
  "regulatory-action.create",
  "regulatory-action.update",
  "workspace-post.create",
  "workspace-post.update",
  "workspace-post.request-review",
  "workspace-post.approve",
  "workspace-post.reject",
  "workspace-post.archive",
  "workspace-post.restore",
  "admin.user.create",
  "admin.user.update",
  "admin.org.create",
  "admin.org.update",
  "admin.role.create",
  "admin.role.update",
  "admin.policy.create",
  "admin.policy.update",
];

function createActionMetadata(
  label: string,
  description: string,
  domain: string,
): PermissionMetadata {
  return { label, description, domain };
}

export const actionPermissionMetadataMap: Record<ActionPermissionCode, PermissionMetadata> = {
  "party.create": createActionMetadata("거래처 등록", "거래처를 신규 등록합니다.", "사업개발"),
  "party.update": createActionMetadata("거래처 수정", "거래처 정보를 수정합니다.", "사업개발"),
  "party.archive": createActionMetadata("거래처 보관", "거래처를 보관 또는 비활성화합니다.", "사업개발"),
  "contract.create": createActionMetadata("계약 등록", "계약을 신규 등록합니다.", "사업개발"),
  "contract.update": createActionMetadata("계약 수정", "계약 정보를 수정합니다.", "사업개발"),
  "contract.approve": createActionMetadata("계약 승인", "계약 승인 상태 전이를 처리합니다.", "사업개발"),
  "contract.archive": createActionMetadata("계약 보관", "계약을 보관합니다.", "사업개발"),
  "opportunity.create": createActionMetadata("기회 등록", "영업 기회를 등록합니다.", "사업개발"),
  "opportunity.update": createActionMetadata("기회 수정", "영업 기회를 수정합니다.", "사업개발"),
  "opportunity.archive": createActionMetadata("기회 보관", "영업 기회를 보관합니다.", "사업개발"),
  "project.create": createActionMetadata("프로젝트 등록", "프로젝트를 등록합니다.", "프로젝트"),
  "project.update": createActionMetadata("프로젝트 수정", "프로젝트 기본정보를 수정합니다.", "프로젝트"),
  "project.archive": createActionMetadata("프로젝트 보관", "프로젝트를 보관합니다.", "프로젝트"),
  "site.create": createActionMetadata("현장 등록", "프로젝트 하위 현장을 등록합니다.", "프로젝트"),
  "site.update": createActionMetadata("현장 수정", "현장 정보를 수정합니다.", "프로젝트"),
  "unit.create": createActionMetadata("유닛 등록", "프로젝트 유닛을 등록합니다.", "프로젝트"),
  "unit.update": createActionMetadata("유닛 수정", "유닛 정보를 수정합니다.", "프로젝트"),
  "system.create": createActionMetadata("시스템 등록", "프로젝트 시스템을 등록합니다.", "프로젝트"),
  "system.update": createActionMetadata("시스템 수정", "시스템 정보를 수정합니다.", "프로젝트"),
  "wbs.create": createActionMetadata("WBS 등록", "WBS를 생성합니다.", "프로젝트"),
  "wbs.update": createActionMetadata("WBS 수정", "WBS를 수정합니다.", "프로젝트"),
  "wbs.archive": createActionMetadata("WBS 보관", "WBS를 보관 또는 삭제 처리합니다.", "프로젝트"),
  "execution-budget.create": createActionMetadata("실행예산 등록", "실행예산을 생성합니다.", "프로젝트"),
  "execution-budget.update": createActionMetadata("실행예산 수정", "실행예산과 원가항목을 수정합니다.", "프로젝트"),
  "execution-budget.approve": createActionMetadata("실행예산 승인", "실행예산 승인 전이를 수행합니다.", "프로젝트"),
  "vendor.create": createActionMetadata("공급업체 등록", "공급업체를 신규 등록합니다.", "공급망"),
  "vendor.update": createActionMetadata("공급업체 수정", "공급업체 정보를 수정합니다.", "공급망"),
  "vendor.archive": createActionMetadata("공급업체 보관", "공급업체를 보관합니다.", "공급망"),
  "material.create": createActionMetadata("자재 등록", "자재 마스터를 신규 등록합니다.", "공급망"),
  "material.update": createActionMetadata("자재 수정", "자재 마스터를 수정합니다.", "공급망"),
  "material.archive": createActionMetadata("자재 보관", "자재를 보관합니다.", "공급망"),
  "purchase-order.create": createActionMetadata("발주 등록", "발주를 신규 작성합니다.", "공급망"),
  "purchase-order.update": createActionMetadata("발주 수정", "초안/제출 발주를 수정합니다.", "공급망"),
  "purchase-order.submit": createActionMetadata("발주 제출", "발주를 승인 요청 상태로 전환합니다.", "공급망"),
  "purchase-order.approve": createActionMetadata("발주 승인", "발주 승인 처리와 예산 약정을 반영합니다.", "공급망"),
  "purchase-order.reject": createActionMetadata("발주 반려", "발주 승인 요청을 반려합니다.", "공급망"),
  "purchase-order.cancel-approval": createActionMetadata("발주 승인 취소", "승인된 발주를 제출 상태로 되돌립니다.", "공급망"),
  "purchase-order.receive": createActionMetadata("입고 등록", "발주 기준 입고를 등록합니다.", "공급망"),
  "purchase-order.cancel-receipt": createActionMetadata("입고 취소", "등록된 입고를 취소합니다.", "공급망"),
  "inventory.receipt": createActionMetadata("재고 입고", "재고 입고 거래를 등록합니다.", "공급망"),
  "inventory.issue": createActionMetadata("재고 출고", "재고 출고 거래를 등록합니다.", "공급망"),
  "inventory.transfer": createActionMetadata("재고 이동", "재고 위치 이동을 요청/처리합니다.", "공급망"),
  "inventory.adjust-request": createActionMetadata("재고 조정 요청", "재고 조정 요청을 생성합니다.", "공급망"),
  "inventory.adjust-approve": createActionMetadata("재고 조정 승인", "재고 조정 요청을 승인합니다.", "공급망"),
  "inventory.adjust-reject": createActionMetadata("재고 조정 반려", "재고 조정 요청을 반려합니다.", "공급망"),
  "module.create": createActionMetadata("모듈 등록", "제작 모듈을 등록합니다.", "제작"),
  "module.update": createActionMetadata("모듈 수정", "제작 모듈을 수정합니다.", "제작"),
  "manufacturing-order.create": createActionMetadata("제작오더 등록", "제작오더를 등록합니다.", "제작"),
  "manufacturing-order.update": createActionMetadata("제작오더 수정", "제작오더를 수정합니다.", "제작"),
  "shipment.create": createActionMetadata("운송 등록", "운송 문서를 등록합니다.", "제작"),
  "shipment.update": createActionMetadata("운송 수정", "운송 문서를 수정합니다.", "제작"),
  "shipment.approve": createActionMetadata("운송 승인", "운송 승인 상태를 처리합니다.", "제작"),
  "itp.create": createActionMetadata("ITP 등록", "ITP를 신규 등록합니다.", "품질"),
  "itp.update": createActionMetadata("ITP 수정", "ITP를 수정합니다.", "품질"),
  "inspection.create": createActionMetadata("검사 등록", "검사 결과를 등록합니다.", "품질"),
  "inspection.update": createActionMetadata("검사 수정", "검사 결과를 수정합니다.", "품질"),
  "inspection.archive": createActionMetadata("검사 삭제/보관", "검사 항목을 삭제 또는 보관합니다.", "품질"),
  "ncr.create": createActionMetadata("NCR 등록", "NCR을 등록합니다.", "품질"),
  "ncr.update": createActionMetadata("NCR 수정", "NCR을 수정합니다.", "품질"),
  "ncr.archive": createActionMetadata("NCR 삭제/보관", "NCR을 삭제 또는 보관합니다.", "품질"),
  "hse.create": createActionMetadata("HSE 등록", "HSE 사고를 등록합니다.", "안전"),
  "hse.update": createActionMetadata("HSE 수정", "HSE 사고를 수정합니다.", "안전"),
  "hse.archive": createActionMetadata("HSE 삭제/보관", "HSE 사고를 삭제 또는 보관합니다.", "안전"),
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
  "commissioning-package.create": createActionMetadata("패키지 등록", "시운전 패키지를 등록합니다.", "시운전"),
  "commissioning-package.update": createActionMetadata("패키지 수정", "시운전 패키지를 수정합니다.", "시운전"),
  "commissioning-package.approve": createActionMetadata("패키지 승인", "패키지 승인 상태를 처리합니다.", "시운전"),
  "regulatory-action.create": createActionMetadata("규제 대응 등록", "규제 대응 항목을 등록합니다.", "시운전"),
  "regulatory-action.update": createActionMetadata("규제 대응 수정", "규제 대응 항목을 수정합니다.", "시운전"),
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
};

export const allPermissionCatalog: KnownPermissionCode[] = [
  ...permissionCatalog,
  ...actionPermissionCatalog,
];

const legacyPermissionImplications: Partial<Record<PermissionCode, ActionPermissionCode[]>> = {
  "business-development.write": [
    "party.create",
    "party.update",
    "party.archive",
    "contract.create",
    "contract.update",
    "contract.approve",
    "contract.archive",
    "opportunity.create",
    "opportunity.update",
    "opportunity.archive",
  ],
  "project.write": [
    "project.create",
    "project.update",
    "project.archive",
    "site.create",
    "site.update",
    "unit.create",
    "unit.update",
    "system.create",
    "system.update",
    "wbs.create",
    "wbs.update",
    "wbs.archive",
    "execution-budget.create",
    "execution-budget.update",
    "execution-budget.approve",
  ],
  "supply-chain.write": [
    "vendor.create",
    "vendor.update",
    "vendor.archive",
    "material.create",
    "material.update",
    "material.archive",
    "purchase-order.create",
    "purchase-order.update",
    "purchase-order.submit",
    "purchase-order.approve",
    "purchase-order.reject",
    "purchase-order.cancel-approval",
    "purchase-order.receive",
    "purchase-order.cancel-receipt",
    "inventory.receipt",
    "inventory.issue",
    "inventory.transfer",
    "inventory.adjust-request",
    "inventory.adjust-approve",
    "inventory.adjust-reject",
  ],
  "manufacturing.write": [
    "module.create",
    "module.update",
    "manufacturing-order.create",
    "manufacturing-order.update",
    "shipment.create",
    "shipment.update",
    "shipment.approve",
  ],
  "quality.write": [
    "itp.create",
    "itp.update",
    "inspection.create",
    "inspection.update",
    "inspection.archive",
    "ncr.create",
    "ncr.update",
    "ncr.archive",
  ],
  "safety.write": ["hse.create", "hse.update", "hse.archive"],
  "finance.write": [
    "accounting-unit.create",
    "accounting-unit.update",
    "accounting-unit.period-open",
    "accounting-unit.period-close",
    "accounting-unit.period-generate",
    "account.create",
    "account.update",
    "account.archive",
    "ap.create",
    "ap.approve",
    "ap.cancel-approval",
    "ap.pay",
    "ap.cancel-payment",
    "ar.create",
    "ar.issue",
    "ar.cancel-issue",
    "ar.collect",
    "ar.cancel-collection",
    "asset.create",
    "asset.update",
    "asset.archive",
    "asset.restore",
    "asset.depreciation-run",
    "journal-entry.create",
    "journal-entry.update",
    "journal-entry.submit",
    "journal-entry.post",
    "journal-entry.reverse",
  ],
  "commissioning.write": [
    "commissioning-package.create",
    "commissioning-package.update",
    "commissioning-package.approve",
    "regulatory-action.create",
    "regulatory-action.update",
  ],
  "workspace.write": [
    "workspace-post.create",
    "workspace-post.update",
    "workspace-post.request-review",
    "workspace-post.approve",
    "workspace-post.reject",
    "workspace-post.archive",
    "workspace-post.restore",
  ],
  "admin.write": [
    "admin.user.create",
    "admin.user.update",
    "admin.org.create",
    "admin.org.update",
    "admin.role.create",
    "admin.role.update",
    "admin.policy.create",
    "admin.policy.update",
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
    key: "business",
    title: "사업개발 액션 권한",
    description: "거래처, 기회, 계약의 등록/수정/승인 액션입니다.",
    permissions: [
      "party.create",
      "party.update",
      "party.archive",
      "contract.create",
      "contract.update",
      "contract.approve",
      "contract.archive",
      "opportunity.create",
      "opportunity.update",
      "opportunity.archive",
    ],
  },
  {
    key: "project",
    title: "프로젝트 액션 권한",
    description: "프로젝트 구조와 실행예산 액션입니다.",
    permissions: [
      "project.create",
      "project.update",
      "project.archive",
      "site.create",
      "site.update",
      "unit.create",
      "unit.update",
      "system.create",
      "system.update",
      "wbs.create",
      "wbs.update",
      "wbs.archive",
      "execution-budget.create",
      "execution-budget.update",
      "execution-budget.approve",
    ],
  },
  {
    key: "supply-chain",
    title: "공급망 액션 권한",
    description: "공급업체, 자재, 발주, 재고 액션입니다.",
    permissions: [
      "vendor.create",
      "vendor.update",
      "vendor.archive",
      "material.create",
      "material.update",
      "material.archive",
      "purchase-order.create",
      "purchase-order.update",
      "purchase-order.submit",
      "purchase-order.approve",
      "purchase-order.reject",
      "purchase-order.cancel-approval",
      "purchase-order.receive",
      "purchase-order.cancel-receipt",
      "inventory.receipt",
      "inventory.issue",
      "inventory.transfer",
      "inventory.adjust-request",
      "inventory.adjust-approve",
      "inventory.adjust-reject",
    ],
  },
  {
    key: "manufacturing",
    title: "제작 액션 권한",
    description: "모듈, 제작오더, 운송 액션입니다.",
    permissions: [
      "module.create",
      "module.update",
      "manufacturing-order.create",
      "manufacturing-order.update",
      "shipment.create",
      "shipment.update",
      "shipment.approve",
    ],
  },
  {
    key: "quality-safety",
    title: "품질/안전 액션 권한",
    description: "품질 검사와 안전 사고 액션입니다.",
    permissions: [
      "itp.create",
      "itp.update",
      "inspection.create",
      "inspection.update",
      "inspection.archive",
      "ncr.create",
      "ncr.update",
      "ncr.archive",
      "hse.create",
      "hse.update",
      "hse.archive",
    ],
  },
  {
    key: "finance",
    title: "재무 액션 권한",
    description: "회계단위, 계정, AP/AR, 자산, 전표 액션입니다.",
    permissions: [
      "accounting-unit.create",
      "accounting-unit.update",
      "accounting-unit.period-open",
      "accounting-unit.period-close",
      "accounting-unit.period-generate",
      "account.create",
      "account.update",
      "account.archive",
      "ap.create",
      "ap.approve",
      "ap.cancel-approval",
      "ap.pay",
      "ap.cancel-payment",
      "ar.create",
      "ar.issue",
      "ar.cancel-issue",
      "ar.collect",
      "ar.cancel-collection",
      "asset.create",
      "asset.update",
      "asset.archive",
      "asset.restore",
      "asset.depreciation-run",
      "journal-entry.create",
      "journal-entry.update",
      "journal-entry.submit",
      "journal-entry.post",
      "journal-entry.reverse",
    ],
  },
  {
    key: "commissioning-workspace-admin",
    title: "시운전/협업/관리 액션 권한",
    description: "시운전, 협업, 관리자 마스터 액션입니다.",
    permissions: [
      "commissioning-package.create",
      "commissioning-package.update",
      "commissioning-package.approve",
      "regulatory-action.create",
      "regulatory-action.update",
      "workspace-post.create",
      "workspace-post.update",
      "workspace-post.request-review",
      "workspace-post.approve",
      "workspace-post.reject",
      "workspace-post.archive",
      "workspace-post.restore",
      "admin.user.create",
      "admin.user.update",
      "admin.org.create",
      "admin.org.update",
      "admin.role.create",
      "admin.role.update",
      "admin.policy.create",
      "admin.policy.update",
    ],
  },
];

const actionRoutePermissions: Array<{
  pattern: RegExp;
  permission: ActionPermissionCode;
}> = [
  { pattern: /^\/business-development\/parties\/new$/, permission: "party.create" },
  { pattern: /^\/business-development\/parties\/[^/]+\/edit$/, permission: "party.update" },
  { pattern: /^\/business-development\/opportunities\/new$/, permission: "opportunity.create" },
  { pattern: /^\/business-development\/opportunities\/[^/]+\/edit$/, permission: "opportunity.update" },
  { pattern: /^\/business-development\/contracts\/new$/, permission: "contract.create" },
  { pattern: /^\/business-development\/contracts\/[^/]+\/edit$/, permission: "contract.update" },
  { pattern: /^\/projects\/new$/, permission: "project.create" },
  { pattern: /^\/projects\/[^/]+\/edit$/, permission: "project.update" },
  { pattern: /^\/projects\/execution-budgets\/new$/, permission: "execution-budget.create" },
  { pattern: /^\/projects\/execution-budgets\/[^/]+\/edit$/, permission: "execution-budget.update" },
  { pattern: /^\/supply-chain\/vendors\/new$/, permission: "vendor.create" },
  { pattern: /^\/supply-chain\/vendors\/[^/]+\/edit$/, permission: "vendor.update" },
  { pattern: /^\/supply-chain\/materials\/new$/, permission: "material.create" },
  { pattern: /^\/supply-chain\/materials\/[^/]+\/edit$/, permission: "material.update" },
  { pattern: /^\/supply-chain\/purchase-orders\/new$/, permission: "purchase-order.create" },
  { pattern: /^\/supply-chain\/purchase-orders\/[^/]+\/edit$/, permission: "purchase-order.update" },
  { pattern: /^\/supply-chain\/inventory\/new$/, permission: "inventory.receipt" },
  { pattern: /^\/manufacturing\/modules\/new$/, permission: "module.create" },
  { pattern: /^\/manufacturing\/modules\/[^/]+\/edit$/, permission: "module.update" },
  { pattern: /^\/manufacturing\/orders\/new$/, permission: "manufacturing-order.create" },
  { pattern: /^\/manufacturing\/orders\/[^/]+\/edit$/, permission: "manufacturing-order.update" },
  { pattern: /^\/manufacturing\/shipments\/new$/, permission: "shipment.create" },
  { pattern: /^\/manufacturing\/shipments\/[^/]+\/edit$/, permission: "shipment.update" },
  { pattern: /^\/quality\/itps\/new$/, permission: "itp.create" },
  { pattern: /^\/quality\/itps\/[^/]+\/edit$/, permission: "itp.update" },
  { pattern: /^\/quality\/inspections\/new$/, permission: "inspection.create" },
  { pattern: /^\/quality\/inspections\/[^/]+\/edit$/, permission: "inspection.update" },
  { pattern: /^\/quality\/ncr\/new$/, permission: "ncr.create" },
  { pattern: /^\/quality\/ncr\/[^/]+\/edit$/, permission: "ncr.update" },
  { pattern: /^\/safety\/hse\/new$/, permission: "hse.create" },
  { pattern: /^\/safety\/hse\/[^/]+\/edit$/, permission: "hse.update" },
  { pattern: /^\/finance\/accounting-units\/new$/, permission: "accounting-unit.create" },
  { pattern: /^\/finance\/accounts\/new$/, permission: "account.create" },
  { pattern: /^\/finance\/accounts\/[^/]+\/edit$/, permission: "account.update" },
  { pattern: /^\/finance\/ap\/new$/, permission: "ap.create" },
  { pattern: /^\/finance\/ar\/new$/, permission: "ar.create" },
  { pattern: /^\/finance\/assets\/new$/, permission: "asset.create" },
  { pattern: /^\/finance\/assets\/[^/]+\/edit$/, permission: "asset.update" },
  { pattern: /^\/finance\/journal-entries\/new$/, permission: "journal-entry.create" },
  { pattern: /^\/finance\/journal-entries\/[^/]+\/edit$/, permission: "journal-entry.update" },
  { pattern: /^\/commissioning\/packages\/new$/, permission: "commissioning-package.create" },
  { pattern: /^\/commissioning\/packages\/[^/]+\/edit$/, permission: "commissioning-package.update" },
  { pattern: /^\/commissioning\/regulatory\/new$/, permission: "regulatory-action.create" },
  { pattern: /^\/commissioning\/regulatory\/[^/]+\/edit$/, permission: "regulatory-action.update" },
];

function getInventoryActionPermission(searchParams?: URLSearchParams | null) {
  const transactionType = searchParams?.get("type");

  switch (transactionType) {
    case "issue":
      return "inventory.issue" as const;
    case "transfer":
      return "inventory.transfer" as const;
    case "adjustment":
      return "inventory.adjust-request" as const;
    case "return":
    case "receipt":
    default:
      return "inventory.receipt" as const;
  }
}

export function getActionPermissionForPath(
  pathname: string,
  searchParams?: URLSearchParams | null,
) {
  if (pathname === "/supply-chain/inventory/new") {
    return getInventoryActionPermission(searchParams);
  }

  return actionRoutePermissions.find((item) => item.pattern.test(pathname))?.permission ?? null;
}
