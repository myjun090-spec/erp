"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DetailField } from "@/components/ui/detail-field";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Panel } from "@/components/ui/panel";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { getNextContractAmendmentVersion } from "@/lib/contract-amendments";
import { canAccessAction } from "@/lib/navigation";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type ContractAmendment = {
  id: string;
  version: string;
  date: string;
  amount: number;
  reason: string;
};

type ContractHistoryEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  actorSnapshot: {
    displayName: string;
    orgUnitName: string;
  };
};

type ContractArInvoice = {
  _id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  collectionSummary?: {
    receivedAmount?: number;
    remainingAmount?: number;
  } | null;
};

type Contract = {
  _id: string;
  contractNo: string;
  contractType: string;
  title: string;
  projectSnapshot: { name: string } | null;
  customerSnapshot: { name: string } | null;
  partnerSnapshots: Array<{ name: string }>;
  startDate: string;
  endDate: string;
  contractAmount: number;
  currency: string;
  status: string;
  amendments: ContractAmendment[];
  changeHistory: ContractHistoryEntry[];
  billingSummary?: {
    contractAmount?: number;
    billedAmount?: number;
    remainingBillableAmount?: number;
    invoiceCount?: number;
  } | null;
  arInvoices?: ContractArInvoice[];
};

const emptyAmendmentDraft = {
  id: "",
  version: "",
  date: "",
  amount: "",
  reason: "",
};

const statusToneMap: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  draft: "default",
  review: "warning",
  active: "success",
  completed: "info",
  terminated: "danger",
  archived: "default",
};

export default function ContractDetailPage() {
  const router = useRouter();
  const { contractId } = useParams<{ contractId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [data, setData] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [amendmentDrawerOpen, setAmendmentDrawerOpen] = useState(false);
  const [amendmentDraft, setAmendmentDraft] = useState(emptyAmendmentDraft);
  const [amendmentSaving, setAmendmentSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.message);
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const amendments = data?.amendments ?? [];
  const arInvoices = data?.arInvoices ?? [];
  const tabItems = [
    { value: "overview", label: "기본정보", caption: "계약 상세" },
    { value: "amendments", label: "변경계약", count: amendments.length, caption: "변경계약 이력" },
    { value: "billing", label: "청구현황", count: arInvoices.length, caption: "AR 및 수금 현황" },
    { value: "history", label: "변경이력", count: data?.changeHistory?.length ?? 0, caption: "수정 및 보관 이벤트" },
  ];

  const closeAmendmentDrawer = () => {
    setAmendmentDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setAmendmentDraft(emptyAmendmentDraft);
  };

  const openNewAmendmentDrawer = () => {
    setAmendmentDraft({
      ...emptyAmendmentDraft,
      version: getNextContractAmendmentVersion(amendments),
      date: new Date().toISOString().slice(0, 10),
    });
    setDeleteConfirmOpen(false);
    setAmendmentDrawerOpen(true);
  };

  const openEditAmendmentDrawer = (amendment: ContractAmendment) => {
    setAmendmentDraft({
      id: amendment.id,
      version: amendment.version,
      date: amendment.date,
      amount: formatIntegerInput(amendment.amount),
      reason: amendment.reason,
    });
    setDeleteConfirmOpen(false);
    setAmendmentDrawerOpen(true);
  };

  const updateAmendmentDraft =
    (key: keyof typeof emptyAmendmentDraft) => (value: string) => {
      setAmendmentDraft((current) => ({
        ...current,
        [key]: key === "amount" ? formatIntegerInput(value) : value,
      }));
    };

  const syncAmendments = async (nextAmendments: ContractAmendment[], actionLabel: string) => {
    setAmendmentSaving(true);

    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amendments: nextAmendments }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: `${actionLabel} 실패`,
          description: json.message || "변경계약 이력을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeAmendmentDrawer();
      pushToast({
        title: actionLabel,
        description: "변경계약 이력이 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: `${actionLabel} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setAmendmentSaving(false);
    }
  };

  const handleSaveAmendment = async () => {
    if (!data) {
      return;
    }

    if (!amendmentDraft.date || !amendmentDraft.amount) {
      pushToast({
        title: "필수 항목",
        description: "변경일과 변경금액을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextAmendment: ContractAmendment = {
      id: amendmentDraft.id || `amendment-${Date.now()}`,
      version: amendmentDraft.version,
      date: amendmentDraft.date,
      amount: parseFormattedInteger(amendmentDraft.amount),
      reason: amendmentDraft.reason.trim(),
    };

    const nextAmendments = amendmentDraft.id
      ? amendments.map((amendment) =>
          amendment.id === amendmentDraft.id ? nextAmendment : amendment,
        )
      : [nextAmendment, ...amendments];

    await syncAmendments(
      nextAmendments,
      amendmentDraft.id ? "변경계약 수정 완료" : "변경계약 추가 완료",
    );
  };

  const handleDeleteAmendment = async () => {
    if (!amendmentDraft.id) {
      return;
    }

    const nextAmendments = amendments.filter(
      (amendment) => amendment.id !== amendmentDraft.id,
    );

    await syncAmendments(nextAmendments, "변경계약 삭제 완료");
  };

  const handleArchiveContract = async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "계약 보관 실패",
          description: json.message || "계약을 보관하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setArchiveConfirmOpen(false);
      pushToast({
        title: "계약 보관 완료",
        description: "계약이 목록에서 제외되도록 보관 처리되었습니다.",
        tone: "success",
      });
      router.push("/business-development/contracts");
    } catch {
      pushToast({
        title: "계약 보관 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    }
  };

  const runStatusAction = async (
    action: "request-review" | "activate",
    successTitle: string,
    successDescription: string,
  ) => {
    setStatusActionLoading(action);
    try {
      const res = await fetch("/api/contracts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds: [contractId] }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: `${successTitle} 실패`,
          description: json.message || "계약 상태를 변경하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      pushToast({
        title: successTitle,
        description: successDescription,
        tone: "success",
      });
    } catch {
      pushToast({
        title: `${successTitle} 실패`,
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setStatusActionLoading(null);
    }
  };

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="계약 로딩 중"
        description="상세 정보를 불러오고 있습니다."
      />
    );
  }

  if (error || !data) {
    return (
      <StatePanel
        variant="error"
        title="계약 조회 실패"
        description={error || "데이터 없음"}
      />
    );
  }
  const canUpdateContract = canAccessAction(viewerPermissions, "contract.update");

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title={data.title}
        description={`${data.contractNo} · ${data.customerSnapshot?.name || "-"} · ${data.contractType}`}
        meta={[
          { label: data.status, tone: statusToneMap[data.status] || "default" },
          { label: "Database", tone: "info" },
        ]}
        actions={
          <>
            {data.status === "draft" ? (
              <PermissionButton
                permission="contract.approve"
                type="button"
                onClick={() =>
                  void runStatusAction(
                    "request-review",
                    "계약 검토 요청 완료",
                    "계약 상태가 검토 단계로 변경되었습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--warning)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--warning)] disabled:opacity-60"
              >
                {statusActionLoading === "request-review" ? "처리 중..." : "검토 요청"}
              </PermissionButton>
            ) : null}
            {data.status === "review" ? (
              <PermissionButton
                permission="contract.approve"
                type="button"
                onClick={() =>
                  void runStatusAction(
                    "activate",
                    "계약 활성 완료",
                    "계약 상태가 활성으로 변경되었습니다.",
                  )
                }
                disabled={statusActionLoading !== null}
                className="rounded-full border border-[color:var(--success)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--success)] disabled:opacity-60"
              >
                {statusActionLoading === "activate" ? "처리 중..." : "계약 활성"}
              </PermissionButton>
            ) : null}
            <PermissionButton
              permission="contract.archive"
              type="button"
              onClick={() => setArchiveConfirmOpen(true)}
              className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
            >
              보관
            </PermissionButton>
            <Link
              href="/business-development/contracts"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            <PermissionLink
              permission="contract.update"
              href={`/business-development/contracts/${data._id}/edit`}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              수정
            </PermissionLink>
          </>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">계약정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="계약번호" value={data.contractNo} />
              <DetailField label="계약명" value={data.title} />
              <DetailField label="계약유형" value={data.contractType} />
              <DetailField label="고객" value={data.customerSnapshot?.name || "-"} />
              <DetailField label="프로젝트" value={data.projectSnapshot?.name || "-"} />
              <DetailField
                label="파트너"
                value={data.partnerSnapshots.map((partner) => partner.name).join(", ") || "-"}
              />
            </dl>
          </Panel>
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">금액/기간</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="계약금액" value={`₩ ${(data.contractAmount || 0).toLocaleString()}`} />
              <DetailField
                label="기청구 금액"
                value={`₩ ${Number(data.billingSummary?.billedAmount || 0).toLocaleString()}`}
              />
              <DetailField
                label="남은 청구 가능 금액"
                value={`₩ ${Number(data.billingSummary?.remainingBillableAmount || 0).toLocaleString()}`}
              />
              <DetailField label="통화" value={data.currency} />
              <DetailField label="시작일" value={data.startDate} />
              <DetailField label="종료일" value={data.endDate} />
              <DetailField
                label="상태"
                value={<StatusBadge label={data.status} tone={statusToneMap[data.status] || "default"} />}
              />
            </dl>
          </Panel>
        </div>
      )}

      {activeTab === "amendments" && (
        <DataTable
          title="변경계약 이력"
          description="계약 변경 차수, 변경금액, 사유를 관리합니다."
          actions={
            <PermissionButton
              permission="contract.update"
              type="button"
              onClick={openNewAmendmentDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              변경계약 추가
            </PermissionButton>
          }
          columns={[
            { key: "version", label: "차수" },
            { key: "date", label: "변경일" },
            { key: "amount", label: "변경금액", align: "right" },
            { key: "reason", label: "사유" },
          ]}
          rows={amendments.map((amendment) => ({
            id: amendment.id,
            versionValue: amendment.version,
            version: <span className="font-medium">{amendment.version}</span>,
            date: amendment.date,
            amount: <span className="font-mono">₩ {amendment.amount.toLocaleString()}</span>,
            reason: amendment.reason || "-",
          }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={canUpdateContract ? (row) => {
            const amendment = amendments.find((item) => item.id === String(row.id));
            if (amendment) {
              openEditAmendmentDrawer(amendment);
            }
          } : undefined}
          getRowAriaLabel={(row) => `${String(row.versionValue)} 변경계약 편집 열기`}
          emptyState={{
            title: "등록된 변경계약이 없습니다",
            description: "우측 상단의 변경계약 추가로 첫 변경 이력을 등록해 주세요.",
            action: (
              <PermissionButton
                permission="contract.update"
                type="button"
                onClick={openNewAmendmentDrawer}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                변경계약 추가
              </PermissionButton>
            ),
          }}
        />
      )}

      {activeTab === "billing" && (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Panel className="p-5">
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                계약 금액
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--text)]">
                ₩ {Number(data.billingSummary?.contractAmount || data.contractAmount || 0).toLocaleString()}
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                기청구 금액
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--info)]">
                ₩ {Number(data.billingSummary?.billedAmount || 0).toLocaleString()}
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                남은 청구 가능 금액
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--warning)]">
                ₩ {Number(data.billingSummary?.remainingBillableAmount || 0).toLocaleString()}
              </div>
            </Panel>
          </div>

          <DataTable
            title="AR 현황"
            description="계약에 연결된 매출전표와 수금 현황을 확인합니다."
            columns={[
              { key: "invoiceNo", label: "청구번호" },
              { key: "invoiceDate", label: "청구일" },
              { key: "dueDate", label: "만기일" },
              { key: "amount", label: "청구금액", align: "right" },
              { key: "receivedAmount", label: "수금액", align: "right" },
              { key: "remainingAmount", label: "잔액", align: "right" },
              { key: "status", label: "상태" },
            ]}
            rows={arInvoices.map((invoice) => ({
              id: invoice._id,
              invoiceNoValue: invoice.invoiceNo,
              invoiceNo: <span className="font-medium">{invoice.invoiceNo}</span>,
              invoiceDate: invoice.invoiceDate || "-",
              dueDate: invoice.dueDate || "-",
              amount: <span className="font-mono">₩ {Number(invoice.totalAmount || 0).toLocaleString()}</span>,
              receivedAmount: (
                <span className="font-mono">
                  ₩ {Number(invoice.collectionSummary?.receivedAmount || 0).toLocaleString()}
                </span>
              ),
              remainingAmount: (
                <span className="font-mono">
                  ₩ {Number(invoice.collectionSummary?.remainingAmount || 0).toLocaleString()}
                </span>
              ),
              status: (
                <StatusBadge
                  label={invoice.status}
                  tone={
                    invoice.status === "received"
                      ? "success"
                      : invoice.status === "partial-received"
                        ? "warning"
                        : invoice.status === "overdue"
                          ? "danger"
                          : invoice.status === "issued"
                            ? "info"
                            : "default"
                  }
                />
              ),
            }))}
            getRowKey={(row) => String(row.id)}
            onRowClick={(row) => {
              router.push(`/finance/ar/${String(row.id)}`);
            }}
            getRowAriaLabel={(row) => `${String(row.invoiceNoValue)} 상세 보기`}
            emptyState={{
              title: "연결된 매출전표가 없습니다",
              description: "재무 > AR 등록에서 이 계약을 선택하면 청구 이력이 여기에 연결됩니다.",
            }}
          />
        </div>
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
        open={amendmentDrawerOpen}
        onClose={closeAmendmentDrawer}
        eyebrow="Amendment"
        title={amendmentDraft.id ? "변경계약 수정" : "변경계약 추가"}
        description="계약 변경 차수와 금액, 사유를 관리합니다."
        footer={
          <>
            {amendmentDraft.id ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={amendmentSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeAmendmentDrawer}
              disabled={amendmentSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAmendment()}
              disabled={amendmentSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {amendmentSaving ? "저장 중..." : amendmentDraft.id ? "수정 저장" : "추가 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="차수"
            type="readonly"
            value={amendmentDraft.version}
          />
          <DatePicker
            label="변경일"
            value={amendmentDraft.date}
            onChange={updateAmendmentDraft("date")}
          />
          <FormField
            label="변경금액"
            type="text"
            inputMode="numeric"
            value={amendmentDraft.amount}
            onChange={updateAmendmentDraft("amount")}
            placeholder="0"
          />
          <FormField
            label="사유"
            type="textarea"
            value={amendmentDraft.reason}
            onChange={updateAmendmentDraft("reason")}
            placeholder="금액 조정, 일정 변경, 범위 추가 등"
            rows={4}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="변경계약을 삭제할까요?"
        description="선택한 변경계약은 목록에서 제거되고, 삭제 이력은 변경이력 탭에 남습니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteAmendment()}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="계약을 보관할까요?"
        description="보관된 계약은 계약 목록에서 제외되지만, 상세와 변경 이력은 그대로 유지됩니다."
        confirmLabel="보관"
        tone="danger"
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => void handleArchiveContract()}
      />
    </>
  );
}
