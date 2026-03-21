"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DetailField } from "@/components/ui/detail-field";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  type WorkspacePostAccessRecord,
  type WorkspaceOwnerOption,
  type WorkspacePostRecord,
  type WorkspacePostVersionRecord,
} from "@/lib/platform-catalog";
import {
  buildWorkspacePostDetailHref,
  type WorkspaceMenuOption,
  buildWorkspaceTabHref,
  normalizeWorkspaceTab,
} from "@/lib/workspace-navigation";
import {
  canArchiveWorkspacePost,
  canCancelWorkspacePostReview,
  canPublishWorkspacePost,
  canRejectWorkspacePostReview,
  canRequestWorkspacePostReview,
  canRestoreWorkspacePost,
  getWorkspacePostActionLabel,
  getWorkspacePostStatusTone,
  type WorkspacePostAction,
} from "@/lib/workspace-post-status";
import { canAccessAction } from "@/lib/navigation";

type WorkspacePostDetailPayload = {
  ok: true;
  source: "database" | "empty";
  data: {
    post: WorkspacePostRecord;
    relatedPosts: WorkspacePostRecord[];
    ownerOptions: WorkspaceOwnerOption[];
    menuOptions: WorkspaceMenuOption[];
    versionHistory: WorkspacePostVersionRecord[];
    accessHistory: WorkspacePostAccessRecord[];
  };
};

function kindLabel(kind: WorkspacePostRecord["kind"]) {
  return kind === "library" ? "자료실" : "공지";
}

function getPermissionForWorkspaceAction(action: WorkspacePostAction) {
  switch (action) {
    case "request-review":
    case "cancel-review":
      return "workspace-post.request-review";
    case "reject-review":
      return "workspace-post.reject";
    case "publish":
      return "workspace-post.approve";
    case "archive":
      return "workspace-post.archive";
    case "restore":
      return "workspace-post.restore";
    default:
      return null;
  }
}

export default function WorkspacePostDetailPage() {
  const router = useRouter();
  const viewerPermissions = useViewerPermissions();
  const params = useParams<{ kind: string; postId: string }>();
  const kind = normalizeWorkspaceTab(params.kind);
  const invalidKind = !kind || kind === "approvals";
  const [post, setPost] = useState<WorkspacePostRecord | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<WorkspacePostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<WorkspaceOwnerOption[]>([]);
  const [menuOptions, setMenuOptions] = useState<WorkspaceMenuOption[]>([]);
  const [versionHistory, setVersionHistory] = useState<WorkspacePostVersionRecord[]>([]);
  const [accessHistory, setAccessHistory] = useState<WorkspacePostAccessRecord[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<WorkspacePostAction | null>(null);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    owner: "",
    linkedMenuHref: "",
    documentRef: "",
  });
  const { pushToast } = useToast();
  const loggedViewId = useRef<string | null>(null);
  const updateEdit = (key: string) => (value: string) => setEditForm(prev => ({ ...prev, [key]: value }));
  const editOwnerOptions = useMemo(() => {
    return ownerOptions;
  }, [ownerOptions]);
  const selectedMenu = useMemo(
    () => menuOptions.find((option) => option.value === editForm.linkedMenuHref) ?? null,
    [editForm.linkedMenuHref, menuOptions],
  );
  const hasLegacyOwner =
    Boolean(post?.owner) && !ownerOptions.some((option) => option.value === post?.owner);
  const hasLegacyMenu =
    Boolean(post?.linkedMenuHref) && !menuOptions.some((option) => option.value === post?.linkedMenuHref);

  const loadDetail = useCallback(async () => {
    if (invalidKind) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/platform/workspace/posts/${params.postId}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as
        | WorkspacePostDetailPayload
        | { ok: false; message?: string };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? "게시물을 불러오지 못했습니다." : json.message);
      }

      if (json.data.post.kind !== kind) {
        throw new Error("요청한 분류와 게시물 종류가 일치하지 않습니다.");
      }

      setPost(json.data.post);
      setRelatedPosts(json.data.relatedPosts);
      setOwnerOptions(json.data.ownerOptions);
      setMenuOptions(json.data.menuOptions);
      setVersionHistory(json.data.versionHistory);
      setAccessHistory(json.data.accessHistory);
      setEditForm({
        title: json.data.post.title,
        owner: json.data.post.owner,
        linkedMenuHref: json.data.post.linkedMenuHref ?? "",
        documentRef: json.data.post.documentRef ?? "",
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "게시물을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [invalidKind, kind, params.postId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!post?.id || loggedViewId.current === post.id) {
      return;
    }

    loggedViewId.current = post.id;
    void fetch(`/api/platform/workspace/posts/${post.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view" }),
    });
  }, [post?.id]);

  const handleSave = async () => {
    if (!editForm.title.trim()) {
      pushToast({ title: "필수 항목", description: "제목을 입력해 주세요.", tone: "warning" });
      return;
    }
    if (!editForm.owner.trim()) {
      pushToast({ title: "필수 항목", description: "담당 조직을 선택해 주세요.", tone: "warning" });
      return;
    }
    if (!editForm.linkedMenuHref.trim()) {
      pushToast({ title: "필수 항목", description: "연결 메뉴를 선택해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/platform/workspace/posts/${params.postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "게시물이 업데이트되었습니다.", tone: "success" });
        setEditOpen(false);
        void loadDetail();
      } else {
        pushToast({ title: "수정 실패", description: json.message ?? "오류가 발생했습니다.", tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async () => {
    if (!actionType) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/workspace/posts/${params.postId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          reason: actionType === "reject-review" ? rejectReason : "",
        }),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        pushToast({
          title: `${getWorkspacePostActionLabel(actionType)} 완료`,
          description: "게시물 상태가 업데이트되었습니다.",
          tone: "success",
        });
        setActionOpen(false);
        setRejectReasonOpen(false);
        setActionType(null);
        setRejectReason("");
        void loadDetail();
      } else {
        pushToast({
          title: `${getWorkspacePostActionLabel(actionType)} 실패`,
          description: json.message ?? "오류가 발생했습니다.",
          tone: "warning",
        });
        setActionOpen(false);
        setRejectReasonOpen(false);
      }
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
      setActionOpen(false);
      setRejectReasonOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyDocumentRef = async () => {
    if (!post?.documentRef) {
      return;
    }

    try {
      await navigator.clipboard.writeText(post.documentRef);
      void fetch(`/api/platform/workspace/posts/${post.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ref-copy" }),
      });
      pushToast({
        title: "문서 ref 복사",
        description: "문서 ref를 클립보드에 복사했습니다.",
        tone: "success",
      });
      void loadDetail();
    } catch {
      pushToast({
        title: "복사 실패",
        description: "문서 ref를 복사하지 못했습니다.",
        tone: "warning",
      });
    }
  };

  if (invalidKind) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-[color:var(--danger)]">
          잘못된 워크스페이스 경로입니다.
        </h2>
        <Link
          href="/workspace"
          className="mt-4 text-sm font-semibold text-[color:var(--primary)]"
        >
          Workspace로 돌아가기
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">
        상세 정보를 불러오는 중입니다.
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-[color:var(--danger)]">
          {error ?? "게시물을 찾을 수 없습니다."}
        </h2>
        <Link
          href={buildWorkspaceTabHref(kind)}
          className="mt-4 text-sm font-semibold text-[color:var(--primary)]"
        >
          {kindLabel(kind)} 목록으로
        </Link>
      </div>
    );
  }

  const canEdit =
    post.status !== "보관" &&
    canAccessAction(viewerPermissions, "workspace-post.update");
  const availableActions: WorkspacePostAction[] = [];

  if (canRequestWorkspacePostReview(post.status)) {
    availableActions.push("request-review");
  }
  if (canCancelWorkspacePostReview(post.status)) {
    availableActions.push("cancel-review");
  }
  if (canRejectWorkspacePostReview(post.status)) {
    availableActions.push("reject-review");
  }
  if (canPublishWorkspacePost(post.status)) {
    availableActions.push("publish");
  }
  if (canArchiveWorkspacePost(post.status)) {
    availableActions.push("archive");
  }
  if (canRestoreWorkspacePost(post.status)) {
    availableActions.push("restore");
  }
  const visibleActions = availableActions.filter((action) =>
    canAccessAction(viewerPermissions, getPermissionForWorkspaceAction(action)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={post.title}
        description={`${kindLabel(post.kind)} 항목의 메타데이터와 검토·게시 상태를 확인합니다.`}
        actions={
          <>
            <Link
              href={buildWorkspaceTabHref(post.kind)}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              {kindLabel(post.kind)} 목록으로
            </Link>
            {visibleActions.map((action) => (
              <PermissionButton
                key={action}
                permission={getPermissionForWorkspaceAction(action)}
                type="button"
                onClick={() => {
                  setActionType(action);
                  if (action === "reject-review") {
                    setRejectReasonOpen(true);
                    return;
                  }
                  setActionOpen(true);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  action === "publish"
                    ? "bg-[color:var(--primary)] text-white"
                    : action === "archive"
                      ? "border border-[color:var(--danger)] text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]"
                      : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]"
                }`}
              >
                {getWorkspacePostActionLabel(action)}
              </PermissionButton>
            ))}
            {canEdit ? (
              <PermissionButton
                permission="workspace-post.update"
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                수정
              </PermissionButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)]">
            기본 정보
          </h3>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <DetailField label="구분" value={kindLabel(post.kind)} />
            <DetailField
              label="상태"
              value={<StatusBadge label={post.status} tone={getWorkspacePostStatusTone(post.status)} />}
            />
            <DetailField label="담당 조직" value={post.owner} />
            <DetailField label="최근 갱신" value={post.updatedAt} />
            <DetailField label="연결 메뉴" value={post.linkedMenuLabel || "-"} />
            <DetailField label="연결 권한" value={post.linkedPermission || "-"} />
            <DetailField
              label="열람 대상"
              value={post.roles.map((role) => role.replaceAll("_", " ")).join(", ")}
            />
            <DetailField
              label="문서 ref"
              value={post.documentRef || "-"}
            />
            <DetailField label="문서 버전" value={post.versionLabel || "v1.0"} />
            <DetailField label="열람 수" value={String(post.viewCount ?? 0)} />
            <DetailField label="문서 ref 사용" value={String(post.refCopyCount ?? 0)} />
          </dl>
          {post.documentRef ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleCopyDocumentRef()}
                className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                문서 ref 복사
              </button>
            </div>
          ) : null}
        </Panel>

        <Panel className="p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)]">
            문서 안내
          </h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
              현재 워크스페이스 데이터 모델은 제목, 소유 조직, 연결 메뉴, 문서 ref, 게시 상태를
              함께 관리합니다.
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
              이 상세 화면은 자료실/공지 항목을 deep link로 직접 열고, 어떤 탭에서 관리되는지
              확인하는 용도로 먼저 연결했습니다.
            </div>
          </div>
        </Panel>
      </div>

      <DataTable
        title="문서 버전 이력"
        description="메타데이터 수정과 게시 승인 기준으로 생성된 버전 이력입니다."
        columns={[
          { key: "versionLabel", label: "버전" },
          { key: "changeType", label: "변경유형" },
          { key: "changedBy", label: "변경자" },
          { key: "changedAt", label: "변경일시" },
        ]}
        rows={versionHistory.map((record) => ({
          id: record.id,
          versionLabel: record.versionLabel,
          changeType: record.changeType,
          changedBy: `${record.changedBy} · ${record.team}`,
          changedAt: record.changedAt,
        }))}
        getRowKey={(row) => String(row.id)}
        emptyState={{
          title: "문서 버전 이력이 없습니다",
          description: "현재 문서에는 아직 버전 이력이 기록되지 않았습니다.",
        }}
      />

      <DataTable
        title="열람/참조 이력"
        description="문서 상세 열람과 문서 ref 사용 이력을 최근 순으로 보여줍니다."
        columns={[
          { key: "action", label: "행동" },
          { key: "actor", label: "사용자" },
          { key: "occurredAt", label: "발생일시" },
        ]}
        rows={accessHistory.map((record) => ({
          id: record.id,
          action: record.action === "ref-copy" ? "문서 ref 사용" : "열람",
          actor: `${record.actor} · ${record.team}`,
          occurredAt: record.occurredAt,
        }))}
        getRowKey={(row) => String(row.id)}
        emptyState={{
          title: "열람 이력이 없습니다",
          description: "아직 이 문서를 조회하거나 문서 ref를 사용한 기록이 없습니다.",
        }}
      />

      <DataTable
        title={`관련 ${kindLabel(post.kind)} 항목`}
        description={`같은 ${kindLabel(post.kind)} 분류의 다른 항목을 이어서 확인할 수 있습니다.`}
        columns={[
          { key: "title", label: "항목" },
          { key: "owner", label: "담당 조직" },
          { key: "updatedAt", label: "최근 갱신" },
          { key: "status", label: "상태" },
        ]}
          rows={relatedPosts.map((record) => ({
            id: record.id,
            postTitle: record.title,
            title: <span className="font-medium">{record.title}</span>,
            owner: record.owner,
            updatedAt: record.updatedAt,
            status: <StatusBadge label={record.status} tone={getWorkspacePostStatusTone(record.status)} />,
          }))}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => router.push(buildWorkspacePostDetailHref(post.kind, String(row.id)))}
        getRowAriaLabel={(row) => `${String(row.postTitle)} 상세 열기`}
        emptyState={{
          title: `다른 ${kindLabel(post.kind)} 항목이 없습니다`,
          description: "현재 권한 기준으로 함께 표시할 관련 항목이 없습니다.",
        }}
      />

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        eyebrow="Workspace"
        title="게시물 수정"
        description="제목, 담당 조직, 연결 메뉴, 문서 ref를 수정합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      >
        <Panel className="p-5">
          <div className="grid gap-4">
            {hasLegacyOwner && (
              <div className="rounded-2xl border border-[rgba(184,123,3,0.18)] bg-[rgba(255,247,214,0.92)] px-4 py-3 text-sm leading-6 text-[rgba(146,98,0,0.96)]">
                현재 게시물의 담당 조직은 조직 마스터에 없습니다. 저장하려면 `/admin`에 등록된 조직을 다시 선택해 주세요.
              </div>
            )}
            {hasLegacyMenu && (
              <div className="rounded-2xl border border-[rgba(184,123,3,0.18)] bg-[rgba(255,247,214,0.92)] px-4 py-3 text-sm leading-6 text-[rgba(146,98,0,0.96)]">
                현재 게시물의 연결 메뉴는 더 이상 유효하지 않습니다. 저장하려면 현재 접근 가능한 메뉴를 다시 선택해 주세요.
              </div>
            )}
            <FormField
              label="제목"
              required
              value={editForm.title}
              onChange={updateEdit("title")}
              placeholder="게시물 제목"
            />
            <FormField
              label="담당 조직"
              type="select"
              required
              value={editForm.owner}
              onChange={updateEdit("owner")}
              options={editOwnerOptions}
            />
            <FormField
              label="연결 메뉴"
              type="select"
              required
              value={editForm.linkedMenuHref}
              onChange={updateEdit("linkedMenuHref")}
              options={menuOptions}
            />
            <FormField
              label="연결 권한"
              type="readonly"
              value={selectedMenu?.permission ?? "-"}
            />
            <FormField
              label="문서 ref"
              value={editForm.documentRef}
              onChange={updateEdit("documentRef")}
              placeholder="DOC-WS-2026-001"
            />
          </div>
        </Panel>
      </Drawer>

      <ConfirmDialog
        open={actionOpen}
        title={actionType ? `${getWorkspacePostActionLabel(actionType)}할까요?` : "상태를 변경할까요?"}
        description={
          actionType === "request-review"
            ? `"${post.title}" 게시물을 승인함으로 보내고 검토중 상태로 전환합니다.`
            : actionType === "cancel-review"
              ? `"${post.title}" 게시물을 초안으로 되돌리고 승인 대기를 종료합니다.`
              : actionType === "reject-review"
                ? `"${post.title}" 게시물을 반려하고 초안 상태로 되돌립니다.`
              : actionType === "publish"
                ? `"${post.title}" 게시물을 게시중으로 전환하고 승인 이력을 남깁니다.`
                : actionType === "archive"
                  ? `"${post.title}" 게시물을 보관합니다. 목록에서 상태가 보관으로 표시되고 복원 전까지 게시 흐름에서 제외됩니다.`
                  : actionType === "restore"
                    ? `"${post.title}" 게시물을 이전 상태로 복원합니다.`
                    : ""
        }
        confirmLabel={actionLoading ? "처리 중..." : actionType ? getWorkspacePostActionLabel(actionType) : "확인"}
        onClose={() => {
          setActionOpen(false);
          setActionType(null);
        }}
        onConfirm={() => void handleAction()}
      />

      <Drawer
        open={rejectReasonOpen}
        onClose={() => {
          setRejectReasonOpen(false);
          setActionType(null);
          setRejectReason("");
        }}
        eyebrow="Workspace"
        title="반려 사유 입력"
        description="반려 사유는 승인 이력에 함께 남고 승인함에서도 다시 확인할 수 있습니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setRejectReasonOpen(false);
                setActionType(null);
                setRejectReason("");
              }}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                if (!rejectReason.trim()) {
                  pushToast({
                    title: "반려 사유 필요",
                    description: "반려 사유를 입력해 주세요.",
                    tone: "warning",
                  });
                  return;
                }
                void handleAction();
              }}
              disabled={actionLoading}
              className="rounded-full border border-[color:var(--danger)] bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {actionLoading ? "처리 중..." : "반려"}
            </button>
          </>
        }
      >
        <Panel className="p-5">
          <FormField
            label="반려 사유"
            type="textarea"
            value={rejectReason}
            onChange={setRejectReason}
            placeholder={`"${post.title}" 게시물을 반려하는 이유를 입력해 주세요.`}
            rows={5}
          />
        </Panel>
      </Drawer>
    </>
  );
}
