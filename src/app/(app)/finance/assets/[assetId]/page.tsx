"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { StatePanel } from "@/components/ui/state-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { getAssetClassLabel, getDepreciationMethodLabel } from "@/lib/fixed-assets";

type AssetDetail = {
  _id: string;
  assetNo: string;
  assetClass: string;
  projectSnapshot: { name: string } | null;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationMethod: string;
  usefulLifeMonths?: number;
  ledgerSummary?: { accumulatedDepreciation?: number; bookValue?: number };
  location?: string;
  status: string;
  depreciationSchedule?: Array<{ period: string; amount: number; accumulated: number; bookValue: number }>;
};

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}`);
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "자산을 불러오지 못했습니다.");
          return;
        }
        setData(json.data);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchData();
  }, [assetId]);

  const mutateAsset = async (action: "archive" | "restore") => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: action === "archive" ? "보관 실패" : "복원 실패",
          description:
            json.message || (action === "archive" ? "자산을 보관하지 못했습니다." : "자산을 복원하지 못했습니다."),
          tone: "warning",
        });
        return;
      }
      pushToast({
        title: action === "archive" ? "보관 완료" : "복원 완료",
        description:
          action === "archive" ? "자산이 보관 처리되었습니다." : "자산이 목록에 다시 표시됩니다.",
        tone: "success",
      });
      if (action === "archive") {
        router.push("/finance/assets");
        return;
      }
      await fetchData();
    } catch {
      pushToast({
        title: action === "archive" ? "보관 실패" : "복원 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setProcessing(false);
      setArchiveConfirmOpen(false);
      setRestoreConfirmOpen(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="자산 로딩 중" description="자산 상세 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="자산 조회 실패" description={error || "데이터가 없습니다."} />;

  const depreciationRows = (data.depreciationSchedule || []).map((item) => ({
    period: item.period,
    amount: <span className="font-mono">₩ {item.amount.toLocaleString()}</span>,
    accumulated: <span className="font-mono">₩ {item.accumulated.toLocaleString()}</span>,
    bookValue: <span className="font-mono">₩ {item.bookValue.toLocaleString()}</span>,
  }));

  const tabItems = [
    { value: "overview", label: "기본정보", caption: "자산 상세" },
    { value: "depreciation", label: "감가상각", count: depreciationRows.length, caption: "감가상각 이력" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={`${data.assetNo} ${getAssetClassLabel(data.assetClass)}`}
        description={`${data.projectSnapshot?.name || "-"} · ${data.location || "-"}`}
        meta={[
          { label: data.status, tone: data.status === "active" ? "success" : data.status === "inactive" ? "warning" : "default" },
          { label: getDepreciationMethodLabel(data.depreciationMethod), tone: "info" },
        ]}
        actions={
          <>
            <Link href="/finance/assets" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              목록으로
            </Link>
            {data.status === "archived" ? (
              <PermissionButton
                permission="asset.restore"
                type="button"
                onClick={() => setRestoreConfirmOpen(true)}
                disabled={processing}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-60"
              >
                복원
              </PermissionButton>
            ) : (
              <>
                <PermissionLink permission="asset.update" href={`/finance/assets/${assetId}/edit`} className="rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]">
                  수정
                </PermissionLink>
                <PermissionButton
                  permission="asset.archive"
                  type="button"
                  onClick={() => setArchiveConfirmOpen(true)}
                  disabled={processing}
                  className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
                >
                  보관
                </PermissionButton>
              </>
            )}
          </>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">자산정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="자산번호" value={data.assetNo} />
              <DetailField label="자산분류" value={getAssetClassLabel(data.assetClass)} />
              <DetailField label="프로젝트" value={data.projectSnapshot?.name || "-"} />
              <DetailField label="취득일" value={data.acquisitionDate} />
              <DetailField label="설치장소" value={data.location || "-"} />
              <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : data.status === "inactive" ? "warning" : "default"} />} />
            </dl>
          </Panel>
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">감가상각 요약</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="취득가액" value={<span className="font-mono">₩ {Number(data.acquisitionCost || 0).toLocaleString()}</span>} />
              <DetailField label="상각방법" value={getDepreciationMethodLabel(data.depreciationMethod)} />
              <DetailField label="내용연수" value={data.usefulLifeMonths ? `${Math.round(data.usefulLifeMonths / 12)}년` : "-"} />
              <DetailField label="감가상각누계" value={<span className="font-mono">₩ {Number(data.ledgerSummary?.accumulatedDepreciation || 0).toLocaleString()}</span>} />
              <DetailField label="장부가액" value={<span className="font-mono font-semibold">₩ {Number(data.ledgerSummary?.bookValue || 0).toLocaleString()}</span>} />
            </dl>
          </Panel>
        </div>
      )}

      {activeTab === "depreciation" && (
        <DataTable
          title="감가상각 이력"
          description="등록된 감가상각 상세 이력입니다."
          columns={[
            { key: "period", label: "기간" },
            { key: "amount", label: "상각액", align: "right" },
            { key: "accumulated", label: "누계액", align: "right" },
            { key: "bookValue", label: "장부가액", align: "right" },
          ]}
          rows={depreciationRows}
          emptyState={{
            title: "등록된 감가상각 이력이 없습니다",
            description:
              data.depreciationMethod === "units-of-production"
                ? "생산량비례법 자산은 실제 사용량 데이터가 연결된 후 감가상각 스케줄을 생성합니다."
                : "감가상각 배치를 실행해 스케줄을 생성해 주세요.",
          }}
        />
      )}

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="자산을 보관할까요?"
        description="보관된 자산은 목록에서 숨겨지고 상세 경로로만 조회됩니다."
        confirmLabel="보관"
        tone="warning"
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => {
          void mutateAsset("archive");
        }}
      />
      <ConfirmDialog
        open={restoreConfirmOpen}
        title="자산을 복원할까요?"
        description="복원된 자산은 다시 목록에 표시되고 기존 상태로 되돌아갑니다."
        confirmLabel="복원"
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={() => {
          void mutateAsset("restore");
        }}
      />
    </>
  );
}
