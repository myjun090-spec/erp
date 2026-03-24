"use client";

import { useEffect, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useRouter } from "next/navigation";
import { useFacilitySelection } from "@/components/layout/facility-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { getAssetClassLabel, getDepreciationMethodLabel } from "@/lib/fixed-assets";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type AssetItem = {
  _id: string;
  assetNo: string;
  assetClass: string;
  projectSnapshot: { name: string } | null;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationMethod: string;
  status: string;
};

const columns = [
  { key: "assetNo", label: "자산번호" },
  { key: "class", label: "자산분류" },
  { key: "project", label: "프로젝트" },
  { key: "acquisitionDate", label: "취득일" },
  { key: "cost", label: "취득가액", align: "right" as const },
  { key: "method", label: "감가상각" },
  { key: "status", label: "상태" },
];

export default function AssetsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningBatch, setRunningBatch] = useState(false);
  const { currentFacilityId } = useFacilitySelection();
  const { pushToast } = useToast();

  async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(appendFacilityIdToPath("/api/assets", currentFacilityId));
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "자산 목록을 불러오지 못했습니다.");
          return;
        }
        setItems(json.data.items);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    void load();
  }, [currentFacilityId]);

  const runDepreciationBatch = async () => {
    setRunningBatch(true);
    try {
      const response = await fetch(
        appendFacilityIdToPath("/api/assets/depreciation", currentFacilityId),
        { method: "POST" },
      );
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "감가상각 배치 실패",
          description: json.message || "감가상각 스케줄을 재계산하지 못했습니다.",
          tone: "warning",
        });
        return;
      }
      pushToast({
        title: "감가상각 배치 완료",
        description:
          `재계산 ${Number(json.data?.recalculatedCount || 0).toLocaleString()}건` +
          (Number(json.data?.skippedCount || 0) > 0
            ? `, 스킵 ${Number(json.data?.skippedCount || 0).toLocaleString()}건`
            : ""),
        tone: "success",
      });
      await load();
    } catch {
      pushToast({
        title: "감가상각 배치 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setRunningBatch(false);
    }
  };

  const rows = items.map((item) => ({
    assetNo: <span className="font-mono text-[color:var(--primary)]">{item.assetNo}</span>,
    class: getAssetClassLabel(item.assetClass),
    project: item.projectSnapshot?.name || "-",
    acquisitionDate: item.acquisitionDate,
    cost: <span className="font-mono">₩ {Number(item.acquisitionCost || 0).toLocaleString()}</span>,
    method: getDepreciationMethodLabel(item.depreciationMethod),
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : item.status === "inactive" ? "warning" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="고정자산 목록"
        description="고정자산을 등록하고 감가상각 현황을 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Team 2", tone: "success" },
        ]}
        actions={
          <>
            <PermissionButton
              permission="asset.depreciation-run"
              type="button"
              onClick={() => void runDepreciationBatch()}
              disabled={runningBatch}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)] disabled:opacity-60"
            >
              {runningBatch ? "배치 실행 중..." : "감가상각 배치"}
            </PermissionButton>
            <PermissionLink permission="asset.create" href="/finance/assets/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              자산 등록
            </PermissionLink>
          </>
        }
      />
      <DataTable
        title="고정자산"
        description="등록된 고정자산 목록입니다."
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(_, index) => {
          const target = items[index];
          if (!target) return;
          router.push(`/finance/assets/${target._id}`);
        }}
        getRowAriaLabel={(_, index) => {
          const target = items[index];
          return target ? `${target.assetNo} 상세 보기` : "고정자산 상세 보기";
        }}
        errorState={error ? { title: "자산 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 자산이 없습니다", description: "새 자산을 등록해 주세요." }}
      />
    </>
  );
}
