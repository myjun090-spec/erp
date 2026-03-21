"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { StatePanel } from "@/components/ui/state-panel";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";

type OpportunityProposal = {
  id: string;
  version: string;
  submittedAt: string;
  result: string;
};

type Opportunity = {
  _id: string;
  opportunityNo: string;
  name: string;
  customerSnapshot: { name: string; code: string } | null;
  opportunityType: string;
  stage: string;
  expectedAmount: number;
  currency: string;
  expectedAwardDate: string;
  ownerUserSnapshot: { displayName: string; orgUnitName: string } | null;
  riskSummary: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  proposals: OpportunityProposal[];
  changeHistory: {
    id: string;
    type: string;
    title: string;
    description: string;
    occurredAt: string;
    actorSnapshot: {
      displayName: string;
      orgUnitName: string;
    };
  }[];
};

const tabItems = [
  { value: "overview", label: "기본정보", caption: "사업기회 상세 정보" },
  { value: "proposals", label: "제안이력", caption: "제출된 제안서 버전" },
  { value: "history", label: "변경이력", caption: "상태 변경 이력" },
];

const stageTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  lead: "default", qualified: "info", proposal: "info",
  negotiation: "warning", "closed-won": "success", "closed-lost": "danger",
};

const proposalResultOptions = [
  { label: "제출 완료", value: "submitted" },
  { label: "보완 요청", value: "revised" },
  { label: "쇼트리스트", value: "shortlisted" },
  { label: "탈락", value: "rejected" },
];

const proposalResultTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  submitted: "info",
  revised: "warning",
  shortlisted: "success",
  rejected: "danger",
};

const emptyProposalDraft = {
  id: "",
  version: "",
  submittedAt: "",
  result: "submitted",
};

function getNextProposalVersion(proposals: OpportunityProposal[]) {
  const parsedVersions = proposals
    .map((proposal) => {
      const match = /^v(\d+)\.(\d+)$/i.exec(proposal.version.trim());

      if (!match) {
        return null;
      }

      return {
        major: Number.parseInt(match[1] ?? "1", 10),
        minor: Number.parseInt(match[2] ?? "0", 10),
      };
    })
    .filter((value): value is { major: number; minor: number } => value !== null);

  if (parsedVersions.length === 0) {
    return `v1.${proposals.length}`;
  }

  const latest = parsedVersions.reduce((current, candidate) => {
    if (candidate.major > current.major) {
      return candidate;
    }

    if (candidate.major === current.major && candidate.minor > current.minor) {
      return candidate;
    }

    return current;
  });

  return `v${latest.major}.${latest.minor + 1}`;
}

export default function OpportunityDetailPage() {
  const router = useRouter();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [data, setData] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [proposalDrawerOpen, setProposalDrawerOpen] = useState(false);
  const [proposalDraft, setProposalDraft] = useState(emptyProposalDraft);
  const [proposalSaving, setProposalSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
      else setError(json.message);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closeProposalDrawer = () => {
    setProposalDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setProposalDraft(emptyProposalDraft);
  };

  const openNewProposalDrawer = () => {
    setProposalDraft({
      ...emptyProposalDraft,
      version: getNextProposalVersion(data?.proposals ?? []),
      submittedAt: new Date().toISOString().slice(0, 10),
    });
    setDeleteConfirmOpen(false);
    setProposalDrawerOpen(true);
  };

  const openEditProposalDrawer = (proposal: OpportunityProposal) => {
    setProposalDraft(proposal);
    setDeleteConfirmOpen(false);
    setProposalDrawerOpen(true);
  };

  const updateProposalDraft =
    (key: keyof typeof emptyProposalDraft) => (value: string) => {
      setProposalDraft((current) => ({
        ...current,
        [key]: value,
      }));
    };

  const syncProposals = async (nextProposals: OpportunityProposal[], actionLabel: string) => {
    setProposalSaving(true);

    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposals: nextProposals }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: `${actionLabel} 실패`,
          description: json.message || "제안 이력을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeProposalDrawer();
      pushToast({
        title: actionLabel,
        description: "제안 이력이 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: `${actionLabel} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setProposalSaving(false);
    }
  };

  const handleSaveProposal = async () => {
    if (!data) {
      return;
    }

    if (!proposalDraft.version || !proposalDraft.submittedAt) {
      pushToast({
        title: "필수 항목",
        description: "버전과 제출일을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextProposal: OpportunityProposal = {
      id: proposalDraft.id || `proposal-${Date.now()}`,
      version: proposalDraft.version || getNextProposalVersion(data.proposals || []),
      submittedAt: proposalDraft.submittedAt,
      result: proposalDraft.result,
    };

    const nextProposals = proposalDraft.id
      ? data.proposals.map((proposal) =>
          proposal.id === proposalDraft.id ? nextProposal : proposal,
        )
      : [nextProposal, ...(data.proposals || [])];

    await syncProposals(nextProposals, proposalDraft.id ? "제안 수정 완료" : "제안 추가 완료");
  };

  const handleDeleteProposal = async () => {
    if (!data || !proposalDraft.id) {
      return;
    }

    const nextProposals = data.proposals.filter(
      (proposal) => proposal.id !== proposalDraft.id,
    );

    await syncProposals(nextProposals, "제안 삭제 완료");
  };

  const handleArchiveOpportunity = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "사업기회 보관 실패",
          description: json.message || "사업기회를 보관하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setArchiveConfirmOpen(false);
      pushToast({
        title: "사업기회 보관 완료",
        description: "사업기회가 목록에서 제외되도록 보관 처리되었습니다.",
        tone: "success",
      });
      router.push("/business-development/opportunities");
    } catch {
      pushToast({
        title: "사업기회 보관 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setArchiving(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="사업기회 로딩 중" description="상세 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="조회 실패" description={error || "데이터 없음"} />;
  const canUpdateOpportunity = canAccessAction(viewerPermissions, "opportunity.update");

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title={data.name}
        description={`${data.opportunityNo} · ${data.customerSnapshot?.name || "-"} · ${data.opportunityType}`}
        meta={[
          { label: data.stage, tone: stageTone[data.stage] || "default" },
          { label: data.status, tone: data.status === "active" ? "success" : "default" },
          { label: "Database", tone: "info" },
        ]}
        actions={
          <>
            <Link href="/business-development/opportunities" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              목록으로
            </Link>
            <PermissionLink permission="opportunity.update" href={`/business-development/opportunities/${data._id}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              수정
            </PermissionLink>
            {data.status !== "archived" ? (
              <PermissionButton
                permission="opportunity.archive"
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
              >
                보관
              </PermissionButton>
            ) : null}
          </>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="기회번호" value={data.opportunityNo} />
              <DetailField label="기회명" value={data.name} />
              <DetailField label="고객" value={data.customerSnapshot?.name || "-"} />
              <DetailField label="기회유형" value={data.opportunityType} />
              <DetailField label="단계" value={<StatusBadge label={data.stage} tone={stageTone[data.stage] || "default"} />} />
              <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : "default"} />} />
            </dl>
          </Panel>
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">금액/일정</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="예상금액" value={`₩ ${data.expectedAmount.toLocaleString()}`} />
              <DetailField label="통화" value={data.currency} />
              <DetailField label="예상수주일" value={data.expectedAwardDate} />
              <DetailField label="담당자" value={data.ownerUserSnapshot ? `${data.ownerUserSnapshot.displayName} (${data.ownerUserSnapshot.orgUnitName})` : "-"} />
            </dl>
          </Panel>
          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">리스크/메모</h3>
            <p className="text-sm leading-7 text-[color:var(--text-muted)]">{data.riskSummary || "등록된 리스크 메모가 없습니다."}</p>
          </Panel>
        </div>
      )}

      {activeTab === "proposals" && (
        <DataTable
          title="제안 이력"
          description="이 사업기회에 제출된 제안서 버전을 관리합니다."
          actions={
            <PermissionButton
              permission="opportunity.update"
              type="button"
              onClick={openNewProposalDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              제안 추가
            </PermissionButton>
          }
          columns={[
            { key: "version", label: "버전" },
            { key: "submittedAt", label: "제출일" },
            { key: "result", label: "결과" },
          ]}
          rows={(data.proposals || []).map((proposal) => ({
            id: proposal.id,
            versionValue: proposal.version,
            version: <span className="font-medium">{proposal.version}</span>,
            submittedAt: proposal.submittedAt,
            result: (
              <StatusBadge
                label={proposal.result}
                tone={proposalResultTone[proposal.result] || "default"}
              />
            ),
          }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={canUpdateOpportunity ? (row) => {
            const proposal = data.proposals.find(
              (item) => item.id === String(row.id),
            );

            if (proposal) {
              openEditProposalDrawer(proposal);
            }
          } : undefined}
          getRowAriaLabel={(row) =>
            `${String(row.versionValue)} 제안 상세 편집 열기`
          }
          emptyState={{
            title: "등록된 제안 이력이 없습니다",
            description: "우측 상단의 제안 추가로 첫 제안 버전을 등록해 주세요.",
            action: (
              <PermissionButton
                permission="opportunity.update"
                type="button"
                onClick={openNewProposalDrawer}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                제안 추가
              </PermissionButton>
            ),
          }}
        />
      )}

      {activeTab === "history" && (
        <Panel className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-[color:var(--text)]">변경이력</h3>
          <div className="space-y-4">
            {(data.changeHistory || []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[color:var(--text)]">
                    {entry.title}
                  </div>
                  <div className="font-mono text-xs text-[color:var(--text-muted)]">
                    {entry.occurredAt.replace("T", " ").slice(0, 16)}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                  {entry.description}
                </p>
                <div className="mt-3 text-xs text-[color:var(--text-muted)]">
                  {entry.actorSnapshot.displayName || "알 수 없음"} · {entry.actorSnapshot.orgUnitName || "-"}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Drawer
        open={proposalDrawerOpen}
        onClose={closeProposalDrawer}
        eyebrow="Proposal"
        title={proposalDraft.id ? "제안 이력 수정" : "제안 이력 추가"}
        description="사업기회 단위로 제출된 제안서 버전, 제출일, 결과를 관리합니다."
        footer={
          <>
            {proposalDraft.id ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={proposalSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeProposalDrawer}
              disabled={proposalSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveProposal();
              }}
              disabled={proposalSaving}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {proposalSaving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-6">
          <Panel className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="버전"
                required
                type="readonly"
                value={proposalDraft.version}
              />
              <DatePicker
                label="제출일"
                required
                value={proposalDraft.submittedAt}
                onChange={updateProposalDraft("submittedAt")}
              />
              <FormField
                label="결과"
                required
                type="select"
                value={proposalDraft.result}
                onChange={updateProposalDraft("result")}
                options={proposalResultOptions}
              />
            </div>
          </Panel>
          <Panel className="p-5">
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
              운영 메모
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
              신규 제안 버전은 기존 이력을 기준으로 자동 증가합니다. 현재 범위에서는 제안
              이력의 메타데이터만 관리하며, 파일 첨부와 상세 설명은 다음 단계에서 연결할 수
              있습니다.
            </p>
          </Panel>
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="이 제안 이력을 삭제할까요?"
        description="삭제 후에는 해당 버전 이력이 목록에서 제거됩니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          void handleDeleteProposal();
        }}
      />
      <ConfirmDialog
        open={archiveConfirmOpen}
        title="사업기회를 보관할까요?"
        description="보관된 사업기회는 기회 목록에서 제외됩니다."
        confirmLabel={archiving ? "보관 중..." : "보관"}
        tone="danger"
        onClose={() => {
          if (!archiving) {
            setArchiveConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void handleArchiveOpportunity();
        }}
      />
    </>
  );
}
