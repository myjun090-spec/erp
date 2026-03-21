"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type AccountDetail = {
  _id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountCode: string | null;
  postingAllowed: boolean;
  status: string;
  description?: string;
  usageSummary?: {
    journalEntryCount?: number;
    childCount?: number;
  } | null;
};

export default function AccountDetailPage() {
  const router = useRouter();
  const { accountId } = useParams<{ accountId: string }>();
  const { pushToast } = useToast();
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "계정과목을 불러오지 못했습니다.");
        return;
      }
      setData(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await response.json();

      if (!json.ok) {
        pushToast({
          title: "보관 실패",
          description: json.message || "계정과목을 보관하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "보관 완료",
        description: "계정과목이 보관되었습니다.",
        tone: "success",
      });
      router.push("/finance/accounts");
    } catch {
      pushToast({
        title: "보관 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setArchiving(false);
      setArchiveConfirmOpen(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="계정과목 로딩 중" description="계정과목 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="계정과목 조회 실패" description={error || "데이터가 없습니다."} />;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={`${data.accountCode} ${data.accountName}`}
        description={`${data.accountType} · ${data.parentAccountCode || "-"}`}
        meta={[
          { label: data.accountType, tone: "info" },
          { label: data.postingAllowed ? "전기가능" : "집계계정", tone: data.postingAllowed ? "success" : "default" },
        ]}
        actions={
          <>
            {data.status !== "archived" ? (
              <PermissionButton
                permission="account.archive"
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
              >
                보관
              </PermissionButton>
            ) : null}
            <Link href="/finance/accounts" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              목록으로
            </Link>
            {data.status !== "archived" ? (
              <PermissionLink
                permission="account.update"
                href={`/finance/accounts/${data._id}/edit`}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                수정
              </PermissionLink>
            ) : null}
          </>
        }
      />
      <Panel className="p-5">
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="계정코드" value={<span className="font-mono">{data.accountCode}</span>} />
          <DetailField label="계정명" value={data.accountName} />
          <DetailField label="계정유형" value={data.accountType} />
          <DetailField label="상위계정" value={data.parentAccountCode ? <span className="font-mono">{data.parentAccountCode}</span> : "-"} />
          <DetailField label="전기가능" value={<StatusBadge label={data.postingAllowed ? "Y" : "N"} tone={data.postingAllowed ? "success" : "default"} />} />
          <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : "default"} />} />
          <DetailField label="전표 사용 건수" value={String(data.usageSummary?.journalEntryCount ?? 0)} />
          <DetailField label="하위계정 수" value={String(data.usageSummary?.childCount ?? 0)} />
        </dl>
        <div className="mt-4">
          <DetailField label="설명" value={data.description || "-"} />
        </div>
      </Panel>

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="계정과목 보관"
        description={`${data.accountCode} 계정을 보관합니다. 하위계정이 남아 있으면 보관할 수 없습니다.`}
        confirmLabel={archiving ? "보관 중..." : "보관"}
        tone="danger"
        onClose={() => {
          if (archiving) return;
          setArchiveConfirmOpen(false);
        }}
        onConfirm={() => {
          if (archiving) return;
          void handleArchive();
        }}
      />
    </>
  );
}
