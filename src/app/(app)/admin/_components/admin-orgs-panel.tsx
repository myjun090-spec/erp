"use client";

import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminUserRecord } from "@/lib/admin-catalog";
import { formatIntegerDisplay } from "@/lib/number-input";
import { adminButtonClassName } from "../_lib/admin-page-helpers";
import type { OrgProvisionForm } from "../_lib/admin-page-types";

type AdminOrgsPanelProps = {
  orgForm: OrgProvisionForm;
  selectedOrgLeadUser: AdminUserRecord | null;
  filteredOrgLeadUsers: AdminUserRecord[];
  currentMembers: AdminUserRecord[];
  assignableUsers: AdminUserRecord[];
  orgLeadSearch: string;
  deferredLeadSearch: string;
  orgMemberSearch: string;
  orgMoveOptions: Array<{ label: string; value: string }>;
  orgMemberMoveTargets: Record<string, string>;
  orgMemberSavingUserId: string | null;
  orgMembershipLockReason: string | null;
  lockedLeadUserIds: string[];
  metaSavingTarget: "orgs" | "roles" | "policies" | null;
  canSubmit?: boolean;
  withPanel?: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onLeadSearchChange: (value: string) => void;
  onOrgMemberSearchChange: (value: string) => void;
  onLeadSelect: (userId: string) => void;
  onOrgMemberMoveTargetChange: (userId: string, orgUnitCode: string) => void;
  onAssignMember: (user: AdminUserRecord) => void;
  onMoveMember: (user: AdminUserRecord, orgUnitCode: string) => void;
  onReset: () => void;
  onSubmit: () => void;
};

export function AdminOrgsPanel({
  orgForm,
  selectedOrgLeadUser,
  filteredOrgLeadUsers,
  currentMembers,
  assignableUsers,
  orgLeadSearch,
  deferredLeadSearch,
  orgMemberSearch,
  orgMoveOptions,
  orgMemberMoveTargets,
  orgMemberSavingUserId,
  orgMembershipLockReason,
  lockedLeadUserIds,
  metaSavingTarget,
  canSubmit = true,
  withPanel = true,
  onNameChange,
  onCategoryChange,
  onStateChange,
  onLeadSearchChange,
  onOrgMemberSearchChange,
  onLeadSelect,
  onOrgMemberMoveTargetChange,
  onAssignMember,
  onMoveMember,
  onReset,
  onSubmit,
}: AdminOrgsPanelProps) {
  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
            Organization Master
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
            조직 추가와 비활성 관리
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            사용자 기본 조직과 메뉴 기준을 바꾸려면 여기서 분류, 책임자,
            상태를 먼저 정리합니다. 조직코드는 저장 시 자동 생성됩니다.
          </p>
        </div>
        <StatusBadge
          label={orgForm.id ? "편집" : "신규"}
          tone={orgForm.id ? "info" : "success"}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField
          label="조직코드"
          type="readonly"
          value={orgForm.id ? orgForm.code : "저장 시 자동 생성"}
        />
        <FormField
          label="조직명"
          required
          value={orgForm.name}
          onChange={onNameChange}
          placeholder="프로젝트운영본부"
        />
        <FormField
          label="분류"
          required
          type="select"
          value={orgForm.category}
          onChange={onCategoryChange}
          options={[
            { label: "프로젝트", value: "프로젝트" },
            { label: "운영", value: "운영" },
            { label: "플랫폼", value: "플랫폼" },
          ]}
        />
        <FormField
          label="조직 상태"
          required
          type="select"
          value={orgForm.state}
          onChange={onStateChange}
          options={[
            { label: "활성", value: "활성" },
            { label: "설계중", value: "설계중" },
            { label: "비활성", value: "비활성" },
          ]}
        />
        <div className="md:col-span-2">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
            책임자 검색
            <span className="ml-1 text-[color:var(--danger)]">*</span>
          </div>
          <div className="mt-2 rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,251,255,0.92))] p-4">
            <FormField
              label="검색"
              value={orgLeadSearch}
              onChange={onLeadSearchChange}
              placeholder="이름, 이메일, 사번으로 검색"
            />
            {selectedOrgLeadUser ? (
              <div className="mt-4 rounded-2xl border border-[rgba(12,102,228,0.16)] bg-[rgba(12,102,228,0.05)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--text)]">
                      {selectedOrgLeadUser.name}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {selectedOrgLeadUser.email} · {selectedOrgLeadUser.employeeNo}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {selectedOrgLeadUser.orgUnitName} · {selectedOrgLeadUser.roleName}
                    </div>
                  </div>
                  <StatusBadge
                    label={`선택됨 · ${selectedOrgLeadUser.state}`}
                    tone={selectedOrgLeadUser.state === "활성" ? "success" : "warning"}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                아직 책임자가 선택되지 않았습니다.
              </div>
            )}

            <div className="mt-4 space-y-2">
              {deferredLeadSearch.trim() ? (
                filteredOrgLeadUsers.length > 0 ? (
                  filteredOrgLeadUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        user.id === orgForm.leadUserId
                          ? "border-[color:var(--primary)] bg-[rgba(12,102,228,0.08)]"
                          : "border-[color:var(--border)] bg-white hover:border-[rgba(12,102,228,0.28)] hover:bg-[rgba(12,102,228,0.03)]"
                      }`}
                      onClick={() => onLeadSelect(user.id)}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[color:var(--text)]">
                          {user.name}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {user.email} · {user.employeeNo}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {user.orgUnitName} · {user.roleName}
                        </div>
                      </div>
                      <StatusBadge
                        label={user.state}
                        tone={user.state === "활성" ? "success" : "warning"}
                      />
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                    검색 결과가 없습니다. 이름이나 이메일을 다시 확인해 주세요.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                  책임자를 찾으려면 이름, 이메일, 사번으로 검색하세요.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm leading-7 text-[color:var(--text-muted)]">
        책임자는 users 컬렉션에서만 선택할 수 있습니다. 조직 비활성은 삭제가 아니라
        신규 배정 중지와 운영 종료 의미이며, 필요하면 사용자 기본 조직을 새
        조직으로 먼저 옮긴 뒤 비활성화하세요.
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              Organization Members
            </div>
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">
              현재 소속 사용자를 확인하고 다른 조직에서 이 조직으로 배치하거나,
              현재 조직 사용자를 다른 조직으로 이동합니다.
            </div>
          </div>
          <StatusBadge
            label={`${formatIntegerDisplay(currentMembers.length)}명 소속`}
            tone="info"
          />
        </div>

        {orgMembershipLockReason ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm text-[color:var(--text-muted)]">
            {orgMembershipLockReason}
          </div>
        ) : (
          <div className="mt-4 grid gap-5">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                사용자 배치
              </div>
              <div className="mt-2 text-sm text-[color:var(--text-muted)]">
                다른 조직에 속한 사용자를 검색해서 현재 조직으로 바로 배치합니다.
              </div>
              <div className="mt-4">
                <FormField
                  label="사용자 검색"
                  value={orgMemberSearch}
                  onChange={onOrgMemberSearchChange}
                  placeholder="이름, 이메일, 사번, 현재 조직 검색"
                />
              </div>
              <div className="mt-4 space-y-2">
                {orgMemberSearch.trim() ? (
                  assignableUsers.length > 0 ? (
                    assignableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[color:var(--text)]">
                            {user.name}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {user.email} · {user.employeeNo}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                            현재 {user.orgUnitName} · {user.roleName}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            label={user.state}
                            tone={user.state === "활성" ? "success" : "warning"}
                          />
                          <button
                            type="button"
                            className={`${adminButtonClassName} border-[color:var(--primary)] bg-[rgba(12,102,228,0.08)] text-[color:var(--primary)] hover:bg-[rgba(12,102,228,0.12)] disabled:opacity-60`}
                            onClick={() => onAssignMember(user)}
                            disabled={orgMemberSavingUserId === user.id}
                          >
                            {orgMemberSavingUserId === user.id
                              ? "배치 중..."
                              : "이 조직에 배치"}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--text-muted)]">
                      배치 가능한 사용자가 없습니다.
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--text-muted)]">
                    다른 조직 사용자를 배치하려면 검색어를 입력하세요.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                현재 소속 사용자
              </div>
              <div className="mt-2 text-sm text-[color:var(--text-muted)]">
                조직에 속한 사용자를 다른 조직으로 이동할 수 있습니다.
              </div>
              <div className="mt-4 space-y-3">
                {currentMembers.length > 0 ? (
                  currentMembers.map((user) => {
                    const isLead = lockedLeadUserIds.includes(user.id);
                    const nextOrgUnitCode = orgMemberMoveTargets[user.id] ?? "";

                    return (
                      <div
                        key={user.id}
                        className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-[color:var(--text)]">
                                {user.name}
                              </div>
                              {isLead ? (
                                <StatusBadge label="책임자" tone="info" />
                              ) : null}
                              <StatusBadge
                                label={user.state}
                                tone={user.state === "활성" ? "success" : "warning"}
                              />
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {user.email} · {user.employeeNo}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {user.roleName}
                            </div>
                          </div>
                          <div className="grid min-w-[220px] gap-2 sm:grid-cols-[1fr_auto]">
                            <select
                              value={nextOrgUnitCode}
                              onChange={(event) =>
                                onOrgMemberMoveTargetChange(
                                  user.id,
                                  event.target.value,
                                )
                              }
                              className="h-11 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 text-sm text-[color:var(--text)] outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                              disabled={isLead || orgMemberSavingUserId === user.id}
                            >
                              <option value="">이동할 조직 선택</option>
                              {orgMoveOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`${adminButtonClassName} border-[color:var(--border)] bg-white text-[color:var(--text)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] disabled:opacity-60`}
                              onClick={() => onMoveMember(user, nextOrgUnitCode)}
                              disabled={
                                isLead ||
                                !nextOrgUnitCode ||
                                orgMemberSavingUserId === user.id
                              }
                            >
                              {orgMemberSavingUserId === user.id
                                ? "이동 중..."
                                : "조직 이동"}
                            </button>
                          </div>
                        </div>
                        {isLead ? (
                          <div className="mt-3 rounded-2xl border border-[rgba(255,171,0,0.2)] bg-[rgba(255,171,0,0.1)] px-4 py-3 text-sm text-[color:var(--warning)]">
                            현재 책임자는 먼저 다른 사용자로 책임자를 저장한 뒤 이동할 수
                            있습니다.
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm text-[color:var(--text-muted)]">
                    현재 이 조직에 소속된 사용자가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
            {metaSavingTarget === "orgs"
              ? "저장 중..."
              : orgForm.id
                ? "조직 변경 저장"
                : "조직 등록"}
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
