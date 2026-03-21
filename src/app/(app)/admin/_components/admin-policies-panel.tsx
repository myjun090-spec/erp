"use client";

import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { adminButtonClassName } from "../_lib/admin-page-helpers";
import type { PolicyProvisionForm } from "../_lib/admin-page-types";

type AdminPoliciesPanelProps = {
  policyForm: PolicyProvisionForm;
  metaSavingTarget: "orgs" | "roles" | "policies" | null;
  canSubmit?: boolean;
  withPanel?: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onRuleSummaryChange: (value: string) => void;
  onReset: () => void;
  onSubmit: () => void;
};

export function AdminPoliciesPanel({
  policyForm,
  metaSavingTarget,
  canSubmit = true,
  withPanel = true,
  onCodeChange,
  onNameChange,
  onTargetChange,
  onStateChange,
  onRuleSummaryChange,
  onReset,
  onSubmit,
}: AdminPoliciesPanelProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
            Policy Master
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
            정책 추가와 상태 운영
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            정책은 세션, 첨부 보안, 직무분리 같은 운영 룰을 문서화하고 상태
            기준으로 적용 범위를 관리합니다.
          </p>
        </div>
        <StatusBadge
          label={policyForm.id ? "편집" : "신규"}
          tone={policyForm.id ? "info" : "success"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField
          label="정책코드"
          required
          value={policyForm.code}
          onChange={onCodeChange}
          placeholder="POL-SESSION-002"
        />
        <FormField
          label="정책명"
          required
          value={policyForm.name}
          onChange={onNameChange}
          placeholder="세션 강화 정책"
        />
        <FormField
          label="적용 대상"
          required
          value={policyForm.target}
          onChange={onTargetChange}
          placeholder="전체 사용자"
        />
        <FormField
          label="정책 상태"
          required
          type="select"
          value={policyForm.state}
          onChange={onStateChange}
          options={[
            { label: "활성", value: "활성" },
            { label: "검토중", value: "검토중" },
            { label: "비활성", value: "비활성" },
          ]}
        />
        <FormField
          label="규칙 요약"
          required
          className="md:col-span-2"
          type="textarea"
          value={policyForm.ruleSummary}
          onChange={onRuleSummaryChange}
          placeholder="유휴 30분 후 재인증, 관리자 세션은 8시간 제한"
          rows={5}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm leading-7 text-[color:var(--text-muted)]">
        정책이 비활성 상태면 권한 계산 시 제외됩니다. 검토중 정책은 문서상 기준
        정리 단계로 두고, 실제 적용은 활성 상태 기준으로 관리하세요.
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
          onClick={onReset}
          disabled={metaSavingTarget !== null}
        >
          입력 초기화
        </button>
        {canSubmit ? (
          <button
            type="button"
            className={`${adminButtonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)] disabled:opacity-60`}
            onClick={onSubmit}
            disabled={metaSavingTarget !== null}
          >
            {metaSavingTarget === "policies"
              ? "저장 중..."
              : policyForm.id
                ? "정책 변경 저장"
                : "정책 등록"}
          </button>
        ) : null}
      </div>
    </>
  );

  if (!withPanel) {
    return <div>{content}</div>;
  }

  return (
    <Panel className="p-5">
      {content}
    </Panel>
  );
}
