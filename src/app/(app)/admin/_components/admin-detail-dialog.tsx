import { Dialog } from "@/components/ui/dialog";
import { FormSection } from "@/components/ui/form-section";
import { Panel } from "@/components/ui/panel";
import { adminButtonClassName } from "../_lib/admin-page-helpers";
import type { ProvisionAdminTabValue } from "../_lib/admin-page-types";

type AdminDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  activeTab: ProvisionAdminTabValue;
};

function getDialogContent(activeTab: ProvisionAdminTabValue) {
  return {
    eyebrow: "Detail",
    title:
      activeTab === "roles"
        ? "표준 역할 템플릿"
        : activeTab === "policies"
          ? "정책 기준 상세"
          : activeTab === "orgs"
            ? "조직 매핑 기준"
            : "SSO 사용자 매핑 기준",
    description:
      activeTab === "roles"
        ? "도메인 화면 권한과 사용자 역할 부여는 이 역할 템플릿을 기준으로 맞춥니다."
        : activeTab === "policies"
          ? "세션, 보안, 직무분리 규칙은 정책 단위로 활성/비활성 상태를 가집니다."
          : activeTab === "orgs"
            ? "조직은 책임 범위와 사용자 기본 조직 기준선을 함께 가집니다."
            : "사용자는 이메일, 조직, 역할, 상태를 기준으로 로그인 허용 여부가 결정됩니다.",
    fields:
      activeTab === "roles"
        ? [
            { label: "공통 역할", value: "Platform Admin" },
            { label: "프로젝트 역할", value: "Project Admin" },
            { label: "품질 역할", value: "NCR Approver" },
            { label: "재무 역할", value: "Journal Poster" },
          ]
        : activeTab === "policies"
          ? [
              { label: "세션 만료", value: "유휴 30분" },
              { label: "직무분리", value: "전표 생성/승인 분리" },
              { label: "첨부 보안", value: "워터마크 + 감사로그" },
              { label: "예외 승인", value: "관리자 검토" },
            ]
          : activeTab === "orgs"
            ? [
                { label: "프로젝트", value: "프로젝트운영본부" },
                { label: "운영", value: "품질보증팀, 재무회계팀" },
                { label: "플랫폼", value: "ERP Platform" },
                { label: "동기화 기준", value: "조직코드 + 사용자 기본 조직" },
              ]
            : [
                { label: "공급자", value: "Google Workspace" },
                { label: "조직 키", value: "orgUnitCode" },
                { label: "역할 키", value: "roleCode" },
                { label: "계정 차단", value: "비활성 또는 잠금 상태" },
              ],
  };
}

export function AdminDetailDialog({
  open,
  onClose,
  activeTab,
}: AdminDetailDialogProps) {
  const dialogContent = getDialogContent(activeTab);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={dialogContent.eyebrow}
      title={dialogContent.title}
      description={dialogContent.description}
      footer={
        <>
          <button
            type="button"
            className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className={`${adminButtonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)]`}
            onClick={onClose}
          >
            확인
          </button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <FormSection
          title="상세 기준"
          description="2팀이 같은 baseline을 재사용할 수 있도록 필드 묶음을 고정합니다."
          fields={dialogContent.fields}
        />
        <Panel className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            Team Interface
          </div>
          <h3 className="mt-3 text-xl font-semibold text-[color:var(--text)]">
            공통 계약 포인트
          </h3>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[color:var(--text-muted)]">
            <div>1. menu metadata와 permission code는 1팀 소유로 고정합니다.</div>
            <div>2. 도메인 화면은 role/policy snapshot을 그대로 참조합니다.</div>
            <div>3. API route는 `requireApiPermission()`으로 권한을 먼저 검증합니다.</div>
            <div>4. Google SSO 실연결 전까지는 preview 세션과 같은 필드 구조를 유지합니다.</div>
          </div>
        </Panel>
      </div>
    </Dialog>
  );
}
