"use client";

import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  AdminCatalog,
  AdminProjectOptionRecord,
} from "@/lib/admin-catalog";
import { formatIntegerDisplay } from "@/lib/number-input";
import { adminButtonClassName } from "../_lib/admin-page-helpers";
import type { UserProvisionForm } from "../_lib/admin-page-types";

type AdminUsersPanelProps = {
  adminCatalog: AdminCatalog;
  userForm: UserProvisionForm;
  projectOptionMap: Map<string, AdminProjectOptionRecord>;
  catalogSource: "database" | "empty";
  catalogError: string | null;
  isUserSaving: boolean;
  canSubmit?: boolean;
  withPanel?: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onOrgUnitCodeChange: (value: string) => void;
  onRoleCodeChange: (value: string) => void;
  onDefaultProjectChange: (value: string) => void;
  onToggleProjectAssignment: (projectId: string) => void;
  onReset: () => void;
  onSubmit: () => void;
};

export function AdminUsersPanel({
  adminCatalog,
  userForm,
  projectOptionMap,
  catalogSource,
  catalogError,
  isUserSaving,
  canSubmit = true,
  withPanel = true,
  onNameChange,
  onEmailChange,
  onStateChange,
  onOrgUnitCodeChange,
  onRoleCodeChange,
  onDefaultProjectChange,
  onToggleProjectAssignment,
  onReset,
  onSubmit,
}: AdminUsersPanelProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
            Access Provisioning
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
            이메일, 역할, 프로젝트 배정
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            관리자와 경영진 예외 계정을 제외한 일반 사용자는 여기서 이메일, 조직,
            역할, 프로젝트 범위를 저장한 뒤 로그인할 수 있습니다.
          </p>
        </div>
        <StatusBadge
          label={userForm.id ? "편집" : "신규"}
          tone={userForm.id ? "info" : "success"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField
          label="표시 이름"
          required
          value={userForm.name}
          onChange={onNameChange}
          placeholder="홍길동"
        />
        <FormField
          label="회사 이메일"
          required
          type="email"
          value={userForm.email}
          onChange={onEmailChange}
          placeholder="name@company.com"
        />
        <FormField
          label="사번"
          type="readonly"
          value={userForm.employeeNo || "저장 시 자동 발급"}
        />
        <FormField
          label="상태"
          type="select"
          value={userForm.state}
          onChange={onStateChange}
          options={[
            { label: "활성", value: "활성" },
            { label: "검토중", value: "검토중" },
            { label: "비활성", value: "비활성" },
          ]}
        />
        <FormField
          label="기본 조직"
          required
          type="select"
          value={userForm.orgUnitCode}
          onChange={onOrgUnitCodeChange}
          options={adminCatalog.orgUnits.map((orgUnit) => ({
            label: `${orgUnit.name} (${orgUnit.code})`,
            value: orgUnit.code,
          }))}
        />
        <FormField
          label="기본 역할"
          required
          type="select"
          value={userForm.roleCode}
          onChange={onRoleCodeChange}
          options={adminCatalog.roles.map((role) => ({
            label: `${role.name} (${role.code})`,
            value: role.code,
          }))}
        />
        <FormField
          label="기본 프로젝트"
          type="select"
          value={userForm.defaultProjectId}
          onChange={onDefaultProjectChange}
          options={userForm.projectAssignments.map((assignment) => ({
            label:
              projectOptionMap.get(assignment.projectId)?.name ??
              assignment.projectId,
            value: assignment.projectId,
          }))}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              Project Assignments
            </div>
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">
              사용자는 여러 프로젝트에 배정될 수 있고, 기본 프로젝트는 배정된
              프로젝트 중에서만 지정합니다.
            </div>
          </div>
          <StatusBadge
            label={`${formatIntegerDisplay(userForm.projectAssignments.length)}개 프로젝트 배정`}
            tone="info"
          />
        </div>
        <div className="mt-4 grid gap-3">
          {adminCatalog.projectOptions.length > 0 ? (
            adminCatalog.projectOptions.map((project) => {
              const assignment =
                userForm.projectAssignments.find(
                  (entry) => entry.projectId === project.projectId,
                ) ?? null;
              const isAssigned = assignment !== null;
              const isDefault =
                userForm.defaultProjectId === project.projectId;

              return (
                <div
                  key={project.projectId}
                  className={`rounded-2xl border p-4 transition ${
                    isAssigned
                      ? "border-[color:var(--primary)] bg-white shadow-[0_12px_24px_rgba(12,102,228,0.08)]"
                      : "border-[color:var(--border)] bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--text)]">
                        {project.name}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {project.code} · {project.status}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isAssigned ? (
                        <button
                          type="button"
                          className="rounded-full border border-[color:var(--warning)] bg-[rgba(255,171,0,0.12)] px-3 py-1.5 text-xs font-semibold text-[color:var(--warning)] transition hover:bg-[rgba(255,171,0,0.18)]"
                          onClick={() => onToggleProjectAssignment(project.projectId)}
                          disabled={isUserSaving}
                        >
                          배정 해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full border border-[color:var(--primary)] bg-[rgba(12,102,228,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[rgba(12,102,228,0.12)]"
                          onClick={() => onToggleProjectAssignment(project.projectId)}
                          disabled={isUserSaving}
                        >
                          프로젝트 배정
                        </button>
                      )}
                      {isAssigned ? (
                        <button
                          type="button"
                          aria-pressed={isDefault}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            isDefault
                              ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white"
                              : "border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                          }`}
                          onClick={() => onDefaultProjectChange(project.projectId)}
                          disabled={isUserSaving}
                        >
                          {isDefault ? "기본 프로젝트" : "기본으로 지정"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isAssigned ? (
                    <div className="mt-4 rounded-2xl border border-[rgba(12,102,228,0.12)] bg-[rgba(12,102,228,0.05)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                      현재는 프로젝트 단위 접근만 관리합니다. 세부 현장 배정은
                      별도 권한 모델이 필요할 때 다시 확장합니다.
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm text-[color:var(--text-muted)]">
              배정 가능한 프로젝트가 아직 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
        <div className="font-semibold text-[color:var(--text)]">운영 기준</div>
        <div>
          1. 관리자 `test@test.com`, 경영진 `test1@test.com`은 env
          예외 계정으로 유지합니다.
        </div>
        <div>
          2. 일반 실무자는 `users.email`과 `roleCode`를 기준으로 로그인 권한을
          받습니다.
        </div>
        <div>
          3. 신규 사번은 저장 시 서버가 자동 발급하고, 이후에는 같은 사번을
          유지합니다.
        </div>
        <div>
          4. 프로젝트는 복수 배정이 가능하며, 접근 제어도 현재는 프로젝트 단위로만
          동작합니다.
        </div>
        <div>
          5. 퇴사자나 차단 대상은 삭제보다 `잠금` 상태로 전환하면 즉시 로그인
          차단됩니다.
        </div>
        {catalogSource === "empty" ? (
          <div className="font-medium text-[color:var(--warning)]">
            현재 관리자 카탈로그가 비어 있습니다. 조직, 역할, 프로젝트와 사용자를
            먼저 등록해 주세요.
          </div>
        ) : null}
          {catalogError ? (
          <div className="font-medium text-[color:var(--warning)]">
            카탈로그 경고: {catalogError}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
          onClick={onReset}
          disabled={isUserSaving}
        >
          입력 초기화
        </button>
        {canSubmit ? (
          <button
            type="button"
            className={`${adminButtonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)] disabled:opacity-60`}
            onClick={onSubmit}
            disabled={isUserSaving}
          >
            {isUserSaving
              ? "저장 중..."
              : userForm.id
                ? "사용자 변경 저장"
                : "사용자 등록"}
          </button>
        ) : null}
      </div>
    </>
  );

  if (!withPanel) {
    return <div>{content}</div>;
  }

  return <Panel className="p-5">{content}</Panel>;
}
