"use client";

import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { permissionSelectionGroups } from "@/lib/navigation";
import { formatIntegerDisplay } from "@/lib/number-input";
import {
  adminButtonClassName,
  getPermissionDisplay,
} from "../_lib/admin-page-helpers";
import type { RoleProvisionForm } from "../_lib/admin-page-types";

type AdminRolesPanelProps = {
  roleForm: RoleProvisionForm;
  selectedRolePermissions: string[];
  selectedRolePermissionSet: Set<string>;
  metaSavingTarget: "orgs" | "roles" | "policies" | null;
  canSubmit?: boolean;
  withPanel?: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onScopeChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onPermissionsTextChange: (value: string) => void;
  onTogglePermission: (permission: string) => void;
  onClearPermissions: () => void;
  onReset: () => void;
  onSubmit: () => void;
};

export function AdminRolesPanel({
  roleForm,
  selectedRolePermissions,
  selectedRolePermissionSet,
  metaSavingTarget,
  canSubmit = true,
  withPanel = true,
  onCodeChange,
  onNameChange,
  onScopeChange,
  onStateChange,
  onPermissionsTextChange,
  onTogglePermission,
  onClearPermissions,
  onReset,
  onSubmit,
}: AdminRolesPanelProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
            Role Master
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
            역할 템플릿과 권한 코드
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            기본 역할은 사용자 권한을 묶는 핵심 마스터입니다. 비활성 역할은
            로그인 권한을 더 이상 부여하지 않습니다.
          </p>
        </div>
        <StatusBadge
          label={roleForm.id ? "편집" : "신규"}
          tone={roleForm.id ? "info" : "success"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField
          label="역할코드"
          required
          value={roleForm.code}
          onChange={onCodeChange}
          placeholder="ROLE-PM-ADMIN"
        />
        <FormField
          label="역할명"
          required
          value={roleForm.name}
          onChange={onNameChange}
          placeholder="Project Admin"
        />
        <FormField
          label="범위"
          required
          type="select"
          value={roleForm.scope}
          onChange={onScopeChange}
          options={[
            { label: "공통", value: "공통" },
            { label: "사업개발", value: "사업개발" },
            { label: "프로젝트", value: "프로젝트" },
            { label: "공급망", value: "공급망" },
            { label: "제작", value: "제작" },
            { label: "품질", value: "품질" },
            { label: "재무", value: "재무" },
            { label: "시운전", value: "시운전" },
          ]}
        />
        <FormField
          label="역할 상태"
          required
          type="select"
          value={roleForm.state}
          onChange={onStateChange}
          options={[
            { label: "활성", value: "활성" },
            { label: "검토중", value: "검토중" },
            { label: "비활성", value: "비활성" },
          ]}
        />
        <FormField
          label="권한 코드"
          required
          className="md:col-span-2"
          type="textarea"
          value={roleForm.permissionsText}
          onChange={onPermissionsTextChange}
          placeholder="project.read, project.write, workspace.read"
          rows={5}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              Selected Permissions
            </div>
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">
              저장은 영어 권한 코드로 유지하고, 화면에서는 한국어 라벨로
              확인합니다.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRolePermissions.length > 0 ? (
              <button
                type="button"
                className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--warning)] hover:text-[color:var(--warning)]"
                onClick={onClearPermissions}
                disabled={metaSavingTarget !== null}
              >
                전체 해제
              </button>
            ) : null}
            <StatusBadge
              label={`${formatIntegerDisplay(selectedRolePermissions.length)}개 선택`}
              tone="info"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedRolePermissions.length > 0 ? (
            selectedRolePermissions.map((permission) => {
              const metadata = getPermissionDisplay(permission);

              return (
                <button
                  key={permission}
                  type="button"
                  className="rounded-2xl border border-[rgba(12,102,228,0.16)] bg-white px-3 py-3 text-left transition hover:border-[color:var(--warning)] hover:bg-[rgba(255,171,0,0.08)]"
                  onClick={() => onTogglePermission(permission)}
                  disabled={metaSavingTarget !== null}
                >
                  <div className="text-xs font-semibold text-[color:var(--text)]">
                    {metadata.label}
                  </div>
                  <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                    {metadata.description}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-medium text-[color:var(--primary)]">
                      {permission}
                    </div>
                    <div className="text-[11px] font-semibold text-[color:var(--warning)]">
                      제거
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--text-muted)]">
              아직 권한 코드가 입력되지 않았습니다.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              Available Permission Codes
            </div>
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">
              카드를 클릭하면 권한 코드 입력창에 자동 반영되며, 다시 클릭하면
              제거됩니다.
            </div>
          </div>
          <StatusBadge label="클릭으로 다중 선택" tone="success" />
        </div>
        <div className="mt-3 space-y-4">
          {permissionSelectionGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2">
                <div className="text-xs font-semibold text-[color:var(--text)]">
                  {group.title}
                </div>
                <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                  {group.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.permissions.map((permission) => {
                  const metadata = getPermissionDisplay(permission);

                  return (
                    <button
                      key={permission}
                      type="button"
                      aria-pressed={selectedRolePermissionSet.has(permission)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selectedRolePermissionSet.has(permission)
                          ? "border-[color:var(--primary)] bg-[rgba(12,102,228,0.08)] shadow-[0_12px_24px_rgba(12,102,228,0.10)]"
                          : "border-[color:var(--border)] bg-white hover:border-[rgba(12,102,228,0.24)] hover:bg-[rgba(12,102,228,0.03)]"
                      }`}
                      onClick={() => onTogglePermission(permission)}
                      disabled={metaSavingTarget !== null}
                    >
                      <div className="text-xs font-semibold text-[color:var(--text)]">
                        {metadata.label}
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                        {metadata.description}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-[11px] font-medium text-[color:var(--primary)]">
                          {permission}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            selectedRolePermissionSet.has(permission)
                              ? "text-[color:var(--primary)]"
                              : "text-[color:var(--text-muted)]"
                          }`}
                        >
                          {selectedRolePermissionSet.has(permission) ? "선택됨" : "추가"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
            {metaSavingTarget === "roles"
              ? "저장 중..."
              : roleForm.id
                ? "역할 변경 저장"
                : "역할 등록"}
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
