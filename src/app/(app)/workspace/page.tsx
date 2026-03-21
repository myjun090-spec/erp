"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerDisplay } from "@/lib/number-input";
import {
  type WorkspaceOwnerOption,
  type ApprovalHistoryRecord,
  type ApprovalTaskRecord,
  type WorkspacePostRecord,
} from "@/lib/platform-catalog";
import {
  buildWorkspacePostDetailHref,
  type WorkspaceMenuOption,
  buildWorkspaceTabHref,
  normalizeWorkspaceTab,
  type WorkspaceTab,
} from "@/lib/workspace-navigation";

const statusToneMap = {
  초안: "info",
  게시중: "success",
  검토중: "warning",
  보관: "default",
  대기: "warning",
  진행중: "info",
  완료: "success",
} as const;

const approvalHistoryResultToneMap = {
  승인: "success",
  완료: "success",
  반려: "danger",
  대기: "warning",
} as const;

type WorkspaceApiPayload = {
  source: "database" | "empty";
  data: {
    notices: WorkspacePostRecord[];
    libraries: WorkspacePostRecord[];
    approvalTasks: ApprovalTaskRecord[];
    approvalHistory: ApprovalHistoryRecord[];
    ownerOptions: WorkspaceOwnerOption[];
    menuOptions: WorkspaceMenuOption[];
  };
};

const initialWorkspaceData: WorkspaceApiPayload["data"] = {
  notices: [],
  libraries: [],
  approvalTasks: [],
  approvalHistory: [],
  ownerOptions: [],
  menuOptions: [],
};

const buttonClassName =
  "rounded-full border px-4 py-2 text-sm font-semibold transition";

function createComposerForm(kind: "notice" | "library") {
  return {
    title: "",
    kind,
    owner: "",
    linkedMenuHref: "",
    documentRef: "",
  };
}

export default function WorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaceData, setWorkspaceData] = useState(initialWorkspaceData);
  const [dataSource, setDataSource] = useState<"database" | "empty">("empty");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [historySearchValue, setHistorySearchValue] = useState("");
  const [historyResultFilter, setHistoryResultFilter] = useState("all");
  const [historyKindFilter, setHistoryKindFilter] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvalActionLoadingId, setApprovalActionLoadingId] = useState<string | null>(null);
  const [selectedApprovalTaskId, setSelectedApprovalTaskId] = useState<string | null>(null);
  const [approvalDrawerOpen, setApprovalDrawerOpen] = useState(false);
  const [approvalRejectReason, setApprovalRejectReason] = useState("");
  const [form, setForm] = useState(createComposerForm("notice"));
  const deferredSearch = useDeferredValue(searchValue);
  const deferredHistorySearch = useDeferredValue(historySearchValue);
  const { pushToast } = useToast();
  const activeTab = normalizeWorkspaceTab(searchParams.get("tab")) ?? "notice";
  const composerKind = activeTab === "library" ? "library" : "notice";
  const update = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const selectedMenu = workspaceData.menuOptions.find((option) => option.value === form.linkedMenuHref) ?? null;

  const loadWorkspaceData = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/workspace", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as WorkspaceApiPayload;
      if (!payload.data) return;
      setWorkspaceData(payload.data);
      setDataSource(payload.source === "database" ? "database" : "empty");
    } catch {
      // Keep mock data when API is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      pushToast({ title: "필수 항목", description: "제목을 입력해 주세요.", tone: "warning" });
      return;
    }
    if (!form.owner.trim()) {
      pushToast({ title: "필수 항목", description: "담당 조직을 선택해 주세요.", tone: "warning" });
      return;
    }
    if (!form.linkedMenuHref.trim()) {
      pushToast({ title: "필수 항목", description: "연결 메뉴를 선택해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/platform/workspace/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "게시물이 등록되었습니다.", tone: "success" });
        setComposerOpen(false);
        setForm(createComposerForm(composerKind));
        void loadWorkspaceData();
      } else {
        pushToast({ title: "등록 실패", description: json.message ?? "오류가 발생했습니다.", tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalTaskAction = async (
    task: ApprovalTaskRecord,
    action: "publish" | "reject-review",
    reason?: string,
  ) => {
    if (task.resourceType !== "workspace_post" || !task.resourceId) {
      pushToast({
        title: "처리 불가",
        description: "현재 승인함에서 바로 처리할 수 없는 항목입니다.",
        tone: "warning",
      });
      return;
    }

    setApprovalActionLoadingId(task.id);
    try {
      const response = await fetch(
        `/api/platform/workspace/posts/${task.resourceId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reason: reason?.trim() ?? "" }),
        },
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        pushToast({
          title: action === "publish" ? "게시 승인 실패" : "반려 실패",
          description: payload.message ?? "승인 항목을 처리하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: action === "publish" ? "게시 승인 완료" : "반려 완료",
        description:
          action === "publish"
            ? "승인함에서 바로 게시 승인했습니다."
            : "승인함에서 바로 반려하고 초안으로 되돌렸습니다.",
        tone: "success",
      });
      setApprovalDrawerOpen(false);
      setSelectedApprovalTaskId(null);
      if (action === "reject-review") {
        setApprovalRejectReason("");
      }
      void loadWorkspaceData();
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setApprovalActionLoadingId(null);
    }
  };

  const selectedApprovalTask = useMemo(
    () =>
      workspaceData.approvalTasks.find((task) => task.id === selectedApprovalTaskId) ?? null,
    [selectedApprovalTaskId, workspaceData.approvalTasks],
  );

  const selectedApprovalResource = useMemo(() => {
    if (!selectedApprovalTask?.resourceId) {
      return null;
    }

    return (
      workspaceData.notices.find((record) => record.id === selectedApprovalTask.resourceId) ??
      workspaceData.libraries.find((record) => record.id === selectedApprovalTask.resourceId) ??
      null
    );
  }, [selectedApprovalTask, workspaceData.libraries, workspaceData.notices]);

  const selectedApprovalHistory = useMemo(
    () =>
      selectedApprovalTask?.resourceId
        ? workspaceData.approvalHistory.filter(
            (record) => record.resourceId === selectedApprovalTask.resourceId,
          )
        : [],
    [selectedApprovalTask?.resourceId, workspaceData.approvalHistory],
  );

  const tabItems: TabItem[] = [
    { value: "notice", label: "공지", count: workspaceData.notices.length, caption: "전사 공지와 운영 브리프" },
    { value: "library", label: "자료실", count: workspaceData.libraries.length, caption: "정책, 가이드, 템플릿" },
    { value: "approvals", label: "승인함", count: workspaceData.approvalTasks.length, caption: "공통 inbox와 action queue" },
  ];

  const summaryCards = [
    {
      label: "게시중 공지",
      value: formatIntegerDisplay(
        workspaceData.notices.filter((record) => record.status === "게시중").length,
      ),
      note: "workspacePosts.notice",
    },
    {
      label: "자료실 파일",
      value: formatIntegerDisplay(workspaceData.libraries.length),
      note: "workspacePosts.library",
    },
    {
      label: "승인 대기",
      value: formatIntegerDisplay(
        workspaceData.approvalTasks.filter((record) => record.status === "대기").length,
      ),
      note: "approvalTasks queue",
    },
  ];

  const filteredRows = (
    activeTab === "notice"
      ? workspaceData.notices
      : activeTab === "library"
        ? workspaceData.libraries
        : workspaceData.approvalTasks
  ).filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) {
      return false;
    }

    if (!deferredSearch.trim()) {
      return true;
    }

    const keyword = deferredSearch.toLowerCase();
    if (activeTab === "approvals") {
      return `${row.title} ${row.owner} ${row.updatedAt} ${row.documentRef ?? ""} ${row.versionLabel ?? ""}`
        .toLowerCase()
        .includes(keyword);
    }

    const documentRef = "documentRef" in row ? row.documentRef ?? "" : "";
    const versionLabel = "versionLabel" in row ? row.versionLabel ?? "" : "";

    return `${row.title} ${row.owner} ${row.updatedAt} ${documentRef} ${versionLabel}`
      .toLowerCase()
      .includes(keyword);
  });

  const filteredApprovalHistory = useMemo(
    () =>
      workspaceData.approvalHistory.filter((record) => {
        if (historyResultFilter !== "all" && record.result !== historyResultFilter) {
          return false;
        }

        if (historyKindFilter === "notice" && record.resourceKind !== "notice") {
          return false;
        }

        if (historyKindFilter === "library" && record.resourceKind !== "library") {
          return false;
        }

        if (
          historyKindFilter === "other" &&
          (record.resourceKind === "notice" || record.resourceKind === "library")
        ) {
          return false;
        }

        if (!deferredHistorySearch.trim()) {
          return true;
        }

        const keyword = deferredHistorySearch.toLowerCase();
        return `${record.action} ${record.target} ${record.actor} ${record.team} ${record.documentRef ?? ""} ${record.versionLabel ?? ""} ${record.reason ?? ""}`
          .toLowerCase()
          .includes(keyword);
      }),
    [deferredHistorySearch, historyKindFilter, historyResultFilter, workspaceData.approvalHistory],
  );

  const tableTitle =
    activeTab === "notice"
      ? "공지 게시판"
      : activeTab === "library"
        ? "자료실"
        : "승인함";

  const tableDescription =
    activeTab === "notice"
      ? "공지 배포와 게시 상태를 공통 패턴으로 관리합니다."
      : activeTab === "library"
        ? "문서 ref, 버전, 열람 수를 자료실 기준으로 관리합니다."
        : "approval_tasks 컬렉션을 기준으로 한 공통 inbox 패턴입니다.";

  const tableColumns = useMemo(() => {
    if (activeTab === "library") {
      return [
        { key: "title", label: "항목" },
        { key: "owner", label: "담당/소유" },
        { key: "documentRef", label: "문서 ref" },
        { key: "versionLabel", label: "문서 버전" },
        { key: "viewCount", label: "열람 수", align: "right" as const },
        { key: "updatedAt", label: "최근 갱신" },
        { key: "status", label: "상태" },
      ];
    }

    if (activeTab === "approvals") {
      return [
        { key: "title", label: "항목" },
        { key: "resourceKind", label: "구분" },
        { key: "documentRef", label: "문서 ref" },
        { key: "versionLabel", label: "문서 버전" },
        { key: "owner", label: "담당/소유" },
        { key: "updatedAt", label: "기한" },
        { key: "status", label: "상태" },
        { key: "actions", label: "액션" },
      ];
    }

    return [
      { key: "title", label: "항목" },
      { key: "owner", label: "담당/소유" },
      { key: "updatedAt", label: "최근 갱신" },
      { key: "status", label: "상태" },
    ];
  }, [activeTab]);

  const tableRows = useMemo(
    () =>
      filteredRows.map((row) => {
        const resourceType = "resourceType" in row ? row.resourceType ?? null : null;
        const resourceId = "resourceId" in row ? row.resourceId ?? null : null;
        const resourceKind = "resourceKind" in row ? row.resourceKind ?? null : null;
        const documentRef = "documentRef" in row ? row.documentRef ?? "-" : "-";
        const versionLabel = "versionLabel" in row ? row.versionLabel ?? "v1.0" : "-";
        const approvalRow = row as ApprovalTaskRecord;

        return {
          id: row.id,
          rowTitle: row.title,
          href: row.href,
          resourceType,
          resourceId,
          title: <span className="font-medium">{row.title}</span>,
          resourceKind:
            resourceKind === "library"
              ? "자료실"
              : resourceKind === "notice"
                ? "공지"
                : "-",
          owner: row.owner,
          documentRef,
          versionLabel,
          viewCount:
            "viewCount" in row ? formatIntegerDisplay(row.viewCount ?? 0) : "-",
          updatedAt: row.updatedAt,
          status: (
            <StatusBadge
              label={row.status}
              tone={statusToneMap[row.status as keyof typeof statusToneMap]}
            />
          ),
          actions:
            activeTab === "approvals" ? (
              resourceType === "workspace_post" &&
              resourceId &&
              row.status === "대기" ? (
                <div className="flex flex-wrap gap-2">
                  <PermissionButton
                    type="button"
                    permission="workspace-post.approve"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleApprovalTaskAction(approvalRow, "publish");
                    }}
                    disabled={approvalActionLoadingId === row.id}
                    className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    게시 승인
                  </PermissionButton>
                  <PermissionButton
                    type="button"
                    permission="workspace-post.reject"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedApprovalTaskId(String(row.id));
                      setApprovalRejectReason("");
                      setApprovalDrawerOpen(true);
                    }}
                    disabled={approvalActionLoadingId === row.id}
                    className="rounded-full border border-[color:var(--danger)] px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] disabled:opacity-60"
                  >
                    반려
                  </PermissionButton>
                </div>
              ) : (
                <span className="text-xs text-[color:var(--text-muted)]">상세 확인</span>
              )
            ) : null,
        };
      }),
    [activeTab, approvalActionLoadingId, filteredRows],
  );

  const approvalHistoryColumns = useMemo(
    () => [
      { key: "action", label: "승인 이력" },
      { key: "resourceKind", label: "구분" },
      { key: "target", label: "대상" },
      { key: "documentRef", label: "문서 ref" },
      { key: "versionLabel", label: "문서 버전" },
      { key: "reason", label: "사유" },
      { key: "actor", label: "처리자" },
      { key: "occurredAt", label: "발생 시각" },
      { key: "result", label: "결과" },
    ],
    [],
  );

  const approvalHistoryRows = useMemo(
    () =>
      filteredApprovalHistory.map((record) => ({
        id: record.id,
        rowTitle: record.target,
        href: record.href,
        action: <span className="font-medium">{record.action}</span>,
        resourceKind:
          record.resourceKind === "notice"
            ? "공지"
            : record.resourceKind === "library"
              ? "자료실"
              : "기타",
        target: record.target,
        documentRef: record.documentRef ?? "-",
        versionLabel: record.versionLabel ?? "-",
        reason: record.reason ?? "-",
        actor: `${record.actor} · ${record.team}`,
        occurredAt: record.occurredAt,
        result: (
          <StatusBadge
            label={record.result}
            tone={
              approvalHistoryResultToneMap[
                record.result as keyof typeof approvalHistoryResultToneMap
              ] ?? "default"
            }
          />
        ),
      })),
    [filteredApprovalHistory],
  );

  function updateActiveTab(nextTab: WorkspaceTab) {
    setSearchValue("");
    setStatusFilter("all");
    router.replace(buildWorkspaceTabHref(nextTab), { scroll: false });
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="공지, 자료실, 승인함의 공통 협업 영역"
        description="Phase 5에서는 협업, 승인, 자료실의 empty/error/loading 패턴과 반응형 입력 흐름을 같은 규칙으로 고정합니다."
        meta={[
          { label: "Approval Inbox", tone: "info" },
          { label: "Workspace UAT", tone: "success" },
          { label: dataSource === "database" ? "MongoDB" : "DB only", tone: dataSource === "database" ? "success" : "default" },
        ]}
        actions={
          <>
            <button
              type="button"
              className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
              onClick={() => {
                updateActiveTab("approvals");
                pushToast({
                  title: "승인함 집중 보기",
                  description: "공통 inbox로 바로 전환했습니다.",
                  tone: "info",
                });
              }}
            >
              승인함 집중
            </button>
            <PermissionButton
              type="button"
              permission="workspace-post.create"
              className={`${buttonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)]`}
              onClick={() => {
                setForm(createComposerForm(composerKind));
                setComposerOpen(true);
              }}
            >
              게시물 등록
            </PermissionButton>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <Panel key={card.label} className="p-5">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              {card.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">
              {card.value}
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
              {card.note}
            </p>
          </Panel>
        ))}
      </div>

      <Tabs
        items={tabItems}
        value={activeTab}
        onChange={(value) => startTransition(() => updateActiveTab(value as WorkspaceTab))}
      />

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={
          activeTab === "approvals"
            ? "제목, 소유 조직, 문서 ref, 버전 키워드 검색"
            : "제목, 소유 조직, 문서 ref, 버전 키워드 검색"
        }
        filters={[
          {
            key: "status",
            label: "상태",
            value: statusFilter,
            options: [
              { value: "all", label: "전체 상태" },
              { value: "초안", label: "초안" },
              { value: "게시중", label: "게시중" },
              { value: "검토중", label: "검토중" },
              { value: "보관", label: "보관" },
              { value: "대기", label: "대기" },
              { value: "진행중", label: "진행중" },
              { value: "완료", label: "완료" },
            ],
          },
        ]}
        onFilterChange={(_, value) => setStatusFilter(value)}
        summary={`${formatIntegerDisplay(filteredRows.length)}건 표시`}
        actions={
          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              setStatusFilter("all");
            }}
            className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
          >
            필터 초기화
          </button>
        }
      />

      <div className="grid gap-6">
        <DataTable
          title={tableTitle}
          description={tableDescription}
          columns={tableColumns}
          rows={tableRows}
          getRowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            if (activeTab === "approvals") {
              setSelectedApprovalTaskId(String(row.id));
              setApprovalRejectReason("");
              setApprovalDrawerOpen(true);
              return;
            }

            router.push(buildWorkspacePostDetailHref(activeTab, String(row.id)));
          }}
          getRowAriaLabel={(row) => `${String(row.rowTitle)} 상세 열기`}
          emptyState={{
            title: `${tableTitle}에 맞는 결과가 없습니다`,
            description: "탭, 상태, 검색어 조합을 조정하면 게시물과 승인 항목을 다시 확인할 수 있습니다.",
            action: (
              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  setStatusFilter("all");
                }}
                className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)]`}
              >
                필터 초기화
              </button>
            ),
          }}
        />
      </div>

      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
              Approval History
            </div>
            <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
              승인 이력
            </h3>
          </div>
          <StatusBadge label="Timeline" tone="info" />
        </div>
        <div className="mt-5 grid gap-4">
          <FilterBar
            searchValue={historySearchValue}
            onSearchChange={setHistorySearchValue}
            searchPlaceholder="액션, 대상, 처리자, 문서 ref, 버전 키워드 검색"
            filters={[
              {
                key: "result",
                label: "결과",
                value: historyResultFilter,
                options: [
                  { value: "all", label: "전체 결과" },
                  { value: "승인", label: "승인" },
                  { value: "반려", label: "반려" },
                  { value: "완료", label: "완료" },
                  { value: "대기", label: "대기" },
                ],
              },
              {
                key: "kind",
                label: "구분",
                value: historyKindFilter,
                options: [
                  { value: "all", label: "전체 구분" },
                  { value: "notice", label: "공지" },
                  { value: "library", label: "자료실" },
                  { value: "other", label: "기타" },
                ],
              },
            ]}
            onFilterChange={(key, value) => {
              if (key === "result") {
                setHistoryResultFilter(value);
                return;
              }
              if (key === "kind") {
                setHistoryKindFilter(value);
              }
            }}
            summary={`${formatIntegerDisplay(filteredApprovalHistory.length)}건 표시`}
            actions={
              <button
                type="button"
                onClick={() => {
                  setHistorySearchValue("");
                  setHistoryResultFilter("all");
                  setHistoryKindFilter("all");
                }}
                className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]`}
              >
                이력 필터 초기화
              </button>
            }
          />

          <DataTable
            title="승인 이력 목록"
            description="문서 구분, 결과, 문서 ref와 버전 기준으로 승인 이력을 빠르게 좁혀볼 수 있습니다."
            columns={approvalHistoryColumns}
            rows={approvalHistoryRows}
            getRowKey={(row) => String(row.id)}
            onRowClick={(row) => {
              const href = String(row.href ?? "");
              if (href.startsWith("/")) {
                router.push(href);
              }
            }}
            getRowAriaLabel={(row) => `${String(row.rowTitle)} 승인 이력 열기`}
            emptyState={{
              title: "조건에 맞는 승인 이력이 없습니다",
              description: "결과, 구분, 검색어 조합을 조정하면 승인 이력을 다시 확인할 수 있습니다.",
              action: (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearchValue("");
                    setHistoryResultFilter("all");
                    setHistoryKindFilter("all");
                  }}
                  className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)]`}
                >
                  이력 필터 초기화
                </button>
              ),
            }}
          />
        </div>
      </Panel>

      <Drawer
        open={approvalDrawerOpen}
        onClose={() => {
          setApprovalDrawerOpen(false);
          setSelectedApprovalTaskId(null);
          setApprovalRejectReason("");
        }}
        eyebrow="Approvals"
        title={selectedApprovalTask?.title ?? "승인 항목 상세"}
        description="승인함에서 문서 구분, 문서 ref, 버전과 최근 승인 이력을 확인하고 바로 처리합니다."
        footer={
          selectedApprovalTask ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setApprovalDrawerOpen(false);
                  setSelectedApprovalTaskId(null);
                  setApprovalRejectReason("");
                }}
                className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)]`}
              >
                닫기
              </button>
              {selectedApprovalTask.href ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(selectedApprovalTask.href);
                    setApprovalDrawerOpen(false);
                    setSelectedApprovalTaskId(null);
                    setApprovalRejectReason("");
                  }}
                  className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text)]`}
                >
                  원문 보기
                </button>
              ) : null}
              {selectedApprovalTask.resourceType === "workspace_post" &&
              selectedApprovalTask.resourceId &&
              selectedApprovalTask.status === "대기" ? (
                <>
                  <PermissionButton
                    type="button"
                    permission="workspace-post.reject"
                    onClick={() => {
                      if (!approvalRejectReason.trim()) {
                        pushToast({
                          title: "반려 사유 필요",
                          description: "반려 사유를 입력해 주세요.",
                          tone: "warning",
                        });
                        return;
                      }
                      void handleApprovalTaskAction(
                        selectedApprovalTask,
                        "reject-review",
                        approvalRejectReason,
                      );
                    }}
                    disabled={approvalActionLoadingId === selectedApprovalTask.id}
                    className={`${buttonClassName} border-[color:var(--danger)] bg-white text-[color:var(--danger)] disabled:opacity-60`}
                  >
                    {approvalActionLoadingId === selectedApprovalTask.id ? "처리 중..." : "반려"}
                  </PermissionButton>
                  <PermissionButton
                    type="button"
                    permission="workspace-post.approve"
                    onClick={() => void handleApprovalTaskAction(selectedApprovalTask, "publish")}
                    disabled={approvalActionLoadingId === selectedApprovalTask.id}
                    className={`${buttonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white disabled:opacity-60`}
                  >
                    {approvalActionLoadingId === selectedApprovalTask.id ? "처리 중..." : "게시 승인"}
                  </PermissionButton>
                </>
              ) : null}
            </>
          ) : null
        }
      >
        {selectedApprovalTask ? (
          <div className="grid gap-5">
            <Panel className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="구분"
                  type="readonly"
                  value={
                    selectedApprovalTask.resourceKind === "library"
                      ? "자료실"
                      : selectedApprovalTask.resourceKind === "notice"
                        ? "공지"
                        : "기타"
                  }
                />
                <FormField label="상태" type="readonly" value={selectedApprovalTask.status} />
                <FormField label="문서 ref" type="readonly" value={selectedApprovalTask.documentRef ?? "-"} />
                <FormField label="문서 버전" type="readonly" value={selectedApprovalTask.versionLabel ?? "-"} />
                <FormField label="담당/소유" type="readonly" value={selectedApprovalTask.owner} />
                <FormField label="기한" type="readonly" value={selectedApprovalTask.updatedAt} />
                <FormField
                  label="문서 제목"
                  type="readonly"
                  value={selectedApprovalResource?.title ?? selectedApprovalTask.title}
                  className="md:col-span-2"
                />
                {selectedApprovalResource ? (
                  <FormField
                    label="연결 메뉴"
                    type="readonly"
                    value={selectedApprovalResource.linkedMenuLabel ?? "-"}
                    className="md:col-span-2"
                  />
                ) : null}
              </div>
            </Panel>

            {selectedApprovalTask.resourceType === "workspace_post" &&
            selectedApprovalTask.resourceId &&
            selectedApprovalTask.status === "대기" ? (
              <Panel className="p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  Reject Reason
                </div>
                <div className="mt-3 grid gap-4">
                  <FormField
                    label="반려 사유"
                    type="textarea"
                    value={approvalRejectReason}
                    onChange={setApprovalRejectReason}
                    placeholder="반려 사유를 입력하면 승인 이력에 함께 남습니다."
                    rows={4}
                  />
                </div>
              </Panel>
            ) : null}

            <DataTable
              title="관련 승인 이력"
              description="현재 승인 항목과 같은 문서에서 발생한 최근 승인/반려/게시 이력을 확인합니다."
              columns={[
                { key: "action", label: "이력" },
                { key: "actor", label: "처리자" },
                { key: "occurredAt", label: "발생 시각" },
                { key: "result", label: "결과" },
                { key: "reason", label: "사유" },
              ]}
              rows={selectedApprovalHistory.map((record) => ({
                id: record.id,
                action: record.action,
                actor: `${record.actor} · ${record.team}`,
                occurredAt: record.occurredAt,
                result: (
                  <StatusBadge
                    label={record.result}
                    tone={
                      approvalHistoryResultToneMap[
                        record.result as keyof typeof approvalHistoryResultToneMap
                      ] ?? "default"
                    }
                  />
                ),
                reason: record.reason ?? "-",
              }))}
              getRowKey={(row) => String(row.id)}
              emptyState={{
                title: "관련 승인 이력이 없습니다",
                description: "아직 이 승인 항목과 연결된 처리 이력이 없습니다.",
              }}
            />
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        eyebrow="Composer"
        title={activeTab === "library" ? "자료실 문서 등록" : "게시물 등록"}
        description="공지/자료실 공통 입력 패턴으로 제목, 담당 조직, 연결 메뉴, 문서 ref를 한 drawer 안에서 처리합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setForm(createComposerForm(composerKind));
              }}
              className={`${buttonClassName} border-[color:var(--border)] bg-white text-[color:var(--text-muted)]`}
            >
              취소
            </button>
            <PermissionButton
              type="button"
              permission="workspace-post.create"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className={`${buttonClassName} border-[color:var(--primary)] bg-[color:var(--primary)] text-white disabled:opacity-60`}
            >
              {saving ? "저장 중..." : "저장"}
            </PermissionButton>
          </>
        }
      >
        <Panel className="p-5">
          <div className="grid gap-4">
            <FormField
              label="제목"
              required
              value={form.title}
              onChange={update("title")}
              placeholder="게시물 제목"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="구분"
                type="select"
                value={form.kind}
                onChange={update("kind")}
                options={[
                  { label: "공지", value: "notice" },
                  { label: "자료실", value: "library" },
                ]}
              />
              <FormField label="초기 상태" type="readonly" value="초안" />
            </div>
            <FormField
              label="담당 조직"
              type="select"
              required
              value={form.owner}
              onChange={update("owner")}
              options={workspaceData.ownerOptions}
            />
            <FormField
              label="연결 메뉴"
              type="select"
              required
              value={form.linkedMenuHref}
              onChange={update("linkedMenuHref")}
              options={workspaceData.menuOptions}
            />
            <FormField
              label="연결 권한"
              type="readonly"
              value={selectedMenu?.permission ?? "-"}
            />
            <FormField
              label="문서 ref"
              value={form.documentRef}
              onChange={update("documentRef")}
              placeholder="DOC-WS-2026-001"
            />
          </div>
        </Panel>
      </Drawer>
    </>
  );
}
