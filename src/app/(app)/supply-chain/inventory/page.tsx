"use client";

import { useEffect, useMemo, useState } from "react";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";
import { canAccessAction } from "@/lib/navigation";
import { inventoryTransactionStatus, inventoryTransactionType } from "@/lib/status-maps";

type InventoryItem = {
  _id: string;
  materialSnapshot: {
    materialCode: string;
    description: string;
    uom: string;
  } | null;
  projectSnapshot: {
    code: string;
    name: string;
  } | null;
  siteSnapshot: {
    code: string;
    name: string;
  } | null;
  storageLocation: string;
  transactionType: string;
  adjustmentDirection: string;
  adjustmentReason: string;
  quantity: number;
  uom: string;
  transactionDate: string;
  referenceSnapshot: {
    referenceNo: string;
    referenceName: string;
  } | null;
  targetSiteSnapshot: {
    siteId: string;
    code: string;
    name: string;
  } | null;
  targetStorageLocation: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
  status: string;
  rejectionReason: string;
  approvedAt: string;
  rejectedAt: string;
  updatedAt: string;
};

type InventorySummaryItem = {
  _id: string;
  materialSnapshot: {
    materialId: string;
    materialCode: string;
    description: string;
    uom: string;
  } | null;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  siteSnapshot: {
    siteId: string;
    code: string;
    name: string;
  } | null;
  storageLocation: string;
  currentQuantity: number;
  uom: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
  lastTransactionDate: string;
};

const columns = [
  { key: "material", label: "자재" },
  { key: "project", label: "프로젝트" },
  { key: "site", label: "현장" },
  { key: "location", label: "보관위치" },
  { key: "type", label: "거래유형" },
  { key: "quantity", label: "수량", align: "right" as const },
  { key: "date", label: "거래일" },
  { key: "reference", label: "참조" },
];

const summaryColumns = [
  { key: "material", label: "자재" },
  { key: "project", label: "프로젝트" },
  { key: "site", label: "현장" },
  { key: "location", label: "보관위치" },
  { key: "currentQuantity", label: "현재고", align: "right" as const },
  { key: "lastTransactionDate", label: "최종거래일" },
];

function getInventoryQualityLabel(value: string) {
  if (value === "quality-hold") {
    return "품질보류";
  }
  if (value === "blocked") {
    return "사용중지";
  }
  return "가용";
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export default function InventoryPage() {
  const { currentProject, currentProjectId } = useProjectSelection();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summaryItems, setSummaryItems] = useState<InventorySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [summaryActionOpen, setSummaryActionOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingDetailAction, setProcessingDetailAction] = useState(false);
  const [includeZeroSummary, setIncludeZeroSummary] = useState(false);
  const [summarySearchValue, setSummarySearchValue] = useState("");
  const [summaryQualityFilter, setSummaryQualityFilter] = useState("all");
  const [historySearchValue, setHistorySearchValue] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");

  async function refreshInventory() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        appendProjectIdToPath(
          `/api/inventory${includeZeroSummary ? "?includeZero=true" : ""}`,
          currentProjectId,
        ),
      );
      const json = await response.json();

      if (!json.ok) {
        setError(json.message || "재고 목록을 불러오지 못했습니다.");
        return;
      }

      setItems(json.data.items ?? []);
      setSummaryItems(json.data.summary ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshInventory();
  }, [currentProjectId, includeZeroSummary]);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    const currentItem = items.find((item) => item._id === selectedItemId);
    if (!currentItem) {
      setDetailOpen(false);
      setSelectedItemId(null);
      setRejectionReason("");
      return;
    }

    setRejectionReason(currentItem.rejectionReason || "");
  }, [items, selectedItemId]);

  async function runBulk(
    action: string,
    targetIds: string[],
    label: string,
    options?: { reason?: string; closeDrawer?: boolean },
  ) {
    const response = await fetch("/api/inventory/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetIds, reason: options?.reason }),
    });
    const json = await response.json();
    if (!json.ok) {
      pushToast({
        title: "재고 요청 처리 실패",
        description: json.message || "재고 요청 상태를 변경하지 못했습니다.",
        tone: "warning",
      });
      return;
    }

    pushToast({
      title: label,
      description: `${formatIntegerDisplay(json.affectedCount || 0)}건 처리했습니다.`,
      tone: "success",
    });

    await refreshInventory();

    if (options?.closeDrawer) {
      setDetailOpen(false);
      setSelectedItemId(null);
      setRejectionReason("");
    }
  }

  const selectedItem = selectedItemId
    ? items.find((item) => item._id === selectedItemId) ?? null
    : null;
  const selectedSummaryItem = selectedSummaryId
    ? summaryItems.find((item) => item._id === selectedSummaryId) ?? null
    : null;
  const selectedTypeDef = selectedItem
    ? inventoryTransactionType[selectedItem.transactionType] ?? inventoryTransactionType.adjustment
    : null;
  const selectedStatusDef = selectedItem
    ? inventoryTransactionStatus[selectedItem.status || "completed"] ??
      inventoryTransactionStatus.completed
    : null;
  const isPendingInventoryRequest = selectedItem?.status === "pending-approval";

  const filteredSummaryItems = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(summarySearchValue);

    return summaryItems.filter((item) => {
      if (summaryQualityFilter !== "all" && item.qualityStatus !== summaryQualityFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.materialSnapshot?.description,
        item.materialSnapshot?.materialCode,
        item.projectSnapshot?.name,
        item.projectSnapshot?.code,
        item.siteSnapshot?.name,
        item.siteSnapshot?.code,
        item.storageLocation,
        item.lotNo,
        item.serialNo,
        item.expiryDate,
        getInventoryQualityLabel(item.qualityStatus),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [summaryItems, summarySearchValue, summaryQualityFilter]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(historySearchValue);

    return items.filter((item) => {
      if (historyTypeFilter !== "all" && item.transactionType !== historyTypeFilter) {
        return false;
      }
      if (historyStatusFilter !== "all" && item.status !== historyStatusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        item.materialSnapshot?.description,
        item.materialSnapshot?.materialCode,
        item.projectSnapshot?.name,
        item.projectSnapshot?.code,
        item.siteSnapshot?.name,
        item.siteSnapshot?.code,
        item.storageLocation,
        item.referenceSnapshot?.referenceNo,
        item.referenceSnapshot?.referenceName,
        item.adjustmentReason,
        item.lotNo,
        item.serialNo,
        item.expiryDate,
        getInventoryQualityLabel(item.qualityStatus),
        inventoryTransactionType[item.transactionType]?.label,
        inventoryTransactionStatus[item.status || "completed"]?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [historySearchValue, historyStatusFilter, historyTypeFilter, items]);

  const rows = filteredItems.map((item) => {
    const typeDef = inventoryTransactionType[item.transactionType] ?? inventoryTransactionType.adjustment;
    const statusDef = inventoryTransactionStatus[item.status || "completed"] ?? inventoryTransactionStatus.completed;
    const isIssue = item.transactionType === "issue";
    const isDecreaseAdjustment =
      item.transactionType === "adjustment" && item.adjustmentDirection === "decrease";

    return {
      id: item._id,
      isPendingInventoryRequest: item.status === "pending-approval",
      material: item.materialSnapshot ? (
        <div>
          <div className="font-medium text-[color:var(--text)]">
            {item.materialSnapshot.description || "-"}
          </div>
          <div className="font-mono text-xs text-[color:var(--text-muted)]">
            {item.materialSnapshot.materialCode || "-"}
          </div>
        </div>
      ) : (
        "-"
      ),
      project: item.projectSnapshot ? (
        <div>
          <div className="font-medium text-[color:var(--text)]">
            {item.projectSnapshot.name || "-"}
          </div>
          <div className="font-mono text-xs text-[color:var(--text-muted)]">
            {item.projectSnapshot.code || "-"}
          </div>
        </div>
      ) : (
        "-"
      ),
      site: item.siteSnapshot ? `${item.siteSnapshot.code} · ${item.siteSnapshot.name}` : "-",
      location: item.storageLocation || "-",
      type: <StatusBadge label={typeDef.label} tone={typeDef.tone} />,
      quantity: (
        <span className="font-mono">
          {isIssue || isDecreaseAdjustment ? "-" : ""}
          {formatIntegerDisplay(item.quantity)} {item.uom || ""}
        </span>
      ),
      date: item.transactionDate || "-",
      status: <StatusBadge label={statusDef.label} tone={statusDef.tone} />,
      reference: item.referenceSnapshot ? (
        <div>
          <div className="font-medium text-[color:var(--text)]">
            {item.referenceSnapshot.referenceNo || "-"}
          </div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {item.referenceSnapshot.referenceName || "-"}
          </div>
        </div>
      ) : item.transactionType === "adjustment" ? (
        <div>
          <div className="font-medium text-[color:var(--text)]">
            {item.adjustmentDirection === "decrease" ? "감액 조정" : "증액 조정"}
          </div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {item.adjustmentReason || "-"}
          </div>
        </div>
      ) : (
        "-"
      ),
    };
  });
  const summaryRows = filteredSummaryItems.map((item) => ({
    id: item._id,
    material: item.materialSnapshot ? (
      <div>
        <div className="font-medium text-[color:var(--text)]">
          {item.materialSnapshot.description || "-"}
        </div>
        <div className="font-mono text-xs text-[color:var(--text-muted)]">
          {item.materialSnapshot.materialCode || "-"}
        </div>
      </div>
    ) : (
      "-"
    ),
    project: item.projectSnapshot ? (
      <div>
        <div className="font-medium text-[color:var(--text)]">
          {item.projectSnapshot.name || "-"}
        </div>
        <div className="font-mono text-xs text-[color:var(--text-muted)]">
          {item.projectSnapshot.code || "-"}
        </div>
      </div>
    ) : (
      "-"
    ),
    site: item.siteSnapshot ? `${item.siteSnapshot.code} · ${item.siteSnapshot.name}` : "-",
    location: item.storageLocation || "-",
    currentQuantity: (
      <div className="space-y-1">
        <span className="font-mono">
          {formatIntegerDisplay(item.currentQuantity)} {item.uom || ""}
        </span>
        {item.lotNo || item.serialNo || item.expiryDate || item.qualityStatus ? (
          <div className="text-xs text-[color:var(--text-muted)]">
            {[
              item.lotNo ? `Lot ${item.lotNo}` : "",
              item.serialNo ? `S/N ${item.serialNo}` : "",
              item.expiryDate ? `EXP ${item.expiryDate}` : "",
              getInventoryQualityLabel(item.qualityStatus),
            ]
              .filter(Boolean)
              .join(" · ") || "-"}
          </div>
        ) : null}
      </div>
    ),
    lastTransactionDate: item.lastTransactionDate || "-",
  }));

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title="재고/입출고 현황"
        description={
          currentProject
            ? `${currentProject.name} 프로젝트 기준 재고 거래 이력을 조회합니다.`
            : "접근 가능한 프로젝트 기준 재고 거래 이력을 조회합니다."
        }
        actions={
          <PermissionLink
            permission="inventory.receipt"
            href="/supply-chain/inventory/new?type=receipt"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            입고 등록
          </PermissionLink>
        }
      />
      <FilterBar
        searchValue={summarySearchValue}
        onSearchChange={setSummarySearchValue}
        searchPlaceholder="자재, 프로젝트, 현장, 보관위치, Lot/Serial 검색"
        filters={[
          {
            key: "quality",
            label: "품질상태",
            value: summaryQualityFilter,
            options: [
              { value: "all", label: "전체" },
              { value: "available", label: "가용" },
              { value: "quality-hold", label: "품질보류" },
              { value: "blocked", label: "사용중지" },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === "quality") {
            setSummaryQualityFilter(value);
          }
        }}
        summary={`${formatIntegerDisplay(filteredSummaryItems.length)}건 표시`}
        actions={
          <button
            type="button"
            onClick={() => {
              setSummarySearchValue("");
              setSummaryQualityFilter("all");
            }}
            className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
          >
            필터 초기화
          </button>
        }
      />
      <DataTable
        title="현재고 요약"
        description="자재, 현장, 보관위치별 현재 재고 잔량입니다. 행을 눌러 출고, 이동, 조정을 바로 진행할 수 있습니다."
        actions={
          <button
            type="button"
            onClick={() => setIncludeZeroSummary((current) => !current)}
            className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]"
          >
            {includeZeroSummary ? "0재고 숨기기" : "0재고 포함"}
          </button>
        }
        columns={summaryColumns}
        rows={summaryRows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(_, index) => {
          setSelectedSummaryId(filteredSummaryItems[index]?._id ?? null);
          setSummaryActionOpen(true);
        }}
        getRowAriaLabel={(_, index) => {
          const target = filteredSummaryItems[index];
          if (!target) {
            return "현재고 작업 열기";
          }
          return `${target.materialSnapshot?.description || "현재고"} 작업 열기`;
        }}
        loading={loading}
        errorState={error ? { title: "현재고 요약 조회 실패", description: error } : null}
        emptyState={{
          title: "현재고가 없습니다",
          description: currentProject
            ? "선택한 프로젝트 기준 현재고가 아직 없습니다."
            : "접근 가능한 프로젝트 기준 현재고가 아직 없습니다.",
        }}
      />
      <Drawer
        open={summaryActionOpen && Boolean(selectedSummaryItem)}
        onClose={() => {
          setSummaryActionOpen(false);
          setSelectedSummaryId(null);
        }}
        eyebrow="Inventory"
        title={
          selectedSummaryItem?.materialSnapshot?.description
            ? `${selectedSummaryItem.materialSnapshot.description} 현재고 작업`
            : "현재고 작업"
        }
        description="현재고 요약에서 선택한 재고를 기준으로 출고, 이동, 조정을 바로 등록합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setSummaryActionOpen(false);
                setSelectedSummaryId(null);
              }}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              닫기
            </button>
            {selectedSummaryItem ? (
              <>
                <PermissionLink
                  permission="inventory.issue"
                  href={`/supply-chain/inventory/new?type=issue&projectId=${selectedSummaryItem.projectSnapshot?.projectId || ""}&siteId=${selectedSummaryItem.siteSnapshot?.siteId || ""}&materialId=${selectedSummaryItem.materialSnapshot?.materialId || ""}&storageLocation=${encodeURIComponent(selectedSummaryItem.storageLocation || "")}&lotNo=${encodeURIComponent(selectedSummaryItem.lotNo || "")}&serialNo=${encodeURIComponent(selectedSummaryItem.serialNo || "")}&expiryDate=${encodeURIComponent(selectedSummaryItem.expiryDate || "")}&qualityStatus=${encodeURIComponent(selectedSummaryItem.qualityStatus || "available")}`}
                  className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
                >
                  출고 등록
                </PermissionLink>
                <PermissionLink
                  permission="inventory.transfer"
                  href={`/supply-chain/inventory/new?type=transfer&projectId=${selectedSummaryItem.projectSnapshot?.projectId || ""}&siteId=${selectedSummaryItem.siteSnapshot?.siteId || ""}&materialId=${selectedSummaryItem.materialSnapshot?.materialId || ""}&storageLocation=${encodeURIComponent(selectedSummaryItem.storageLocation || "")}&lotNo=${encodeURIComponent(selectedSummaryItem.lotNo || "")}&serialNo=${encodeURIComponent(selectedSummaryItem.serialNo || "")}&expiryDate=${encodeURIComponent(selectedSummaryItem.expiryDate || "")}&qualityStatus=${encodeURIComponent(selectedSummaryItem.qualityStatus || "available")}`}
                  className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
                >
                  재고 이동
                </PermissionLink>
                <PermissionLink
                  permission="inventory.adjust-request"
                  href={`/supply-chain/inventory/new?type=adjustment&projectId=${selectedSummaryItem.projectSnapshot?.projectId || ""}&siteId=${selectedSummaryItem.siteSnapshot?.siteId || ""}&materialId=${selectedSummaryItem.materialSnapshot?.materialId || ""}&storageLocation=${encodeURIComponent(selectedSummaryItem.storageLocation || "")}&lotNo=${encodeURIComponent(selectedSummaryItem.lotNo || "")}&serialNo=${encodeURIComponent(selectedSummaryItem.serialNo || "")}&expiryDate=${encodeURIComponent(selectedSummaryItem.expiryDate || "")}&qualityStatus=${encodeURIComponent(selectedSummaryItem.qualityStatus || "available")}`}
                  className="rounded-full border border-[color:var(--warning)] bg-[rgba(255,243,214,0.72)] px-4 py-2 text-sm font-semibold text-[color:var(--warning)]"
                >
                  재고 조정
                </PermissionLink>
              </>
            ) : null}
          </>
        }
      >
        {selectedSummaryItem ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    자재
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--text)]">
                    {selectedSummaryItem.materialSnapshot?.description || "-"}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[color:var(--text-muted)]">
                    {selectedSummaryItem.materialSnapshot?.materialCode || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    현재고
                  </div>
                  <div className="mt-2 font-mono text-sm text-[color:var(--text)]">
                    {formatIntegerDisplay(selectedSummaryItem.currentQuantity)} {selectedSummaryItem.uom || ""}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    프로젝트
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedSummaryItem.projectSnapshot
                      ? `${selectedSummaryItem.projectSnapshot.code} · ${selectedSummaryItem.projectSnapshot.name}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    현장
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedSummaryItem.siteSnapshot
                      ? `${selectedSummaryItem.siteSnapshot.code} · ${selectedSummaryItem.siteSnapshot.name}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    보관위치
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedSummaryItem.storageLocation || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    최종거래일
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedSummaryItem.lastTransactionDate || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    재고속성
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {[
                      selectedSummaryItem.lotNo ? `Lot ${selectedSummaryItem.lotNo}` : "",
                      selectedSummaryItem.serialNo ? `S/N ${selectedSummaryItem.serialNo}` : "",
                      selectedSummaryItem.expiryDate ? `EXP ${selectedSummaryItem.expiryDate}` : "",
                      getInventoryQualityLabel(selectedSummaryItem.qualityStatus),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5 text-sm leading-7 text-[color:var(--text-muted)]">
              이동은 출발 위치에서 재고를 차감하고 도착 위치에 새 재고를 생성합니다. 일부 수량만 이동하면 현재 위치 요약은 줄고, 도착 위치 요약이 새로 생깁니다.
            </div>
          </div>
        ) : null}
      </Drawer>
      <FilterBar
        searchValue={historySearchValue}
        onSearchChange={setHistorySearchValue}
        searchPlaceholder="자재, 프로젝트, 현장, 참조번호, Lot/Serial 검색"
        filters={[
          {
            key: "type",
            label: "거래유형",
            value: historyTypeFilter,
            options: [
              { value: "all", label: "전체" },
              { value: "receipt", label: "입고" },
              { value: "issue", label: "출고" },
              { value: "transfer", label: "이동" },
              { value: "return", label: "반품" },
              { value: "adjustment", label: "조정" },
            ],
          },
          {
            key: "status",
            label: "상태",
            value: historyStatusFilter,
            options: [
              { value: "all", label: "전체" },
              { value: "pending-approval", label: "승인대기" },
              { value: "completed", label: "완료" },
              { value: "rejected", label: "반려" },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === "type") {
            setHistoryTypeFilter(value);
            return;
          }
          if (key === "status") {
            setHistoryStatusFilter(value);
          }
        }}
        summary={`${formatIntegerDisplay(filteredItems.length)}건 표시`}
        actions={
          <button
            type="button"
            onClick={() => {
              setHistorySearchValue("");
              setHistoryTypeFilter("all");
              setHistoryStatusFilter("all");
            }}
            className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
          >
            필터 초기화
          </button>
        }
      />
      <BulkActionTable
        title="입출고 이력"
        description="재고 요청은 행을 열어 승인/반려를 검토하고, 승인된 거래만 현재고에 반영됩니다."
        columns={[...columns, { key: "status", label: "상태" }]}
        rows={rows}
        loading={loading}
        getRowKey={(row) => String(row.id)}
        onRowClick={(_, index) => {
          setSelectedItemId(filteredItems[index]?._id ?? null);
          setDetailOpen(true);
        }}
        getRowAriaLabel={(_, index) => {
          const target = filteredItems[index];
          if (!target) {
            return "재고 거래 상세 보기";
          }
          return `${target.materialSnapshot?.description || "재고 거래"} 상세 보기`;
        }}
        bulkActions={[
          {
            key: "approve-inventory-request",
            label: "요청 승인",
            tone: "success",
            confirmTitle: "선택한 재고 요청을 승인할까요?",
            confirmDescription: "승인되면 현재고에 즉시 반영됩니다.",
            isVisible: (selectedIds) =>
              canAccessAction(viewerPermissions, "inventory.adjust-approve") &&
              selectedIds.length > 0 &&
              selectedIds.every((id) => rows.find((row) => String(row.id) === id)?.isPendingInventoryRequest === true),
            onAction: (ids) => runBulk("approve-inventory-request", ids, "요청 승인"),
          },
        ]}
        errorState={error ? { title: "재고 조회 실패", description: error } : null}
        emptyState={{
          title: "등록된 재고 거래가 없습니다",
          description: currentProject
            ? "선택한 프로젝트에 재고 거래가 아직 없습니다."
            : "접근 가능한 프로젝트에 재고 거래가 아직 없습니다.",
          action: (
            <PermissionLink
              permission="inventory.receipt"
              href="/supply-chain/inventory/new?type=receipt"
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              첫 입고 등록
            </PermissionLink>
          ),
        }}
      />
      <Drawer
        open={detailOpen && Boolean(selectedItem)}
        onClose={() => {
          setDetailOpen(false);
          setSelectedItemId(null);
          setRejectionReason("");
        }}
        eyebrow="Inventory"
        title={
          selectedItem?.materialSnapshot?.description
            ? `${selectedItem.materialSnapshot.description} 거래 상세`
            : "재고 거래 상세"
        }
        description="재고 거래는 append-only 이력으로 관리하며, 출고·이동·조정 요청은 승인 후 현재고에 반영합니다."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setDetailOpen(false);
                setSelectedItemId(null);
                setRejectionReason("");
              }}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              닫기
            </button>
            {isPendingInventoryRequest ? (
              <>
                <PermissionButton
                  type="button"
                  permission="inventory.adjust-approve"
                  disabled={processingDetailAction}
                  onClick={() => {
                    if (!selectedItemId) {
                      return;
                    }

                    setProcessingDetailAction(true);
                    void runBulk("approve-inventory-request", [selectedItemId], "요청 승인", {
                      closeDrawer: true,
                    }).finally(() => setProcessingDetailAction(false));
                  }}
                  className="rounded-full border border-[color:var(--success)] bg-[rgba(223,246,235,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--success)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  요청 승인
                </PermissionButton>
                <PermissionButton
                  type="button"
                  permission="inventory.adjust-reject"
                  disabled={processingDetailAction}
                  onClick={() => {
                    if (!selectedItemId) {
                      return;
                    }

                    if (!rejectionReason.trim()) {
                      pushToast({
                        title: "반려 사유 입력 필요",
                        description: "재고 요청 반려 사유를 입력해 주세요.",
                        tone: "warning",
                      });
                      return;
                    }

                    setProcessingDetailAction(true);
                    void runBulk("reject-inventory-request", [selectedItemId], "요청 반려", {
                      reason: rejectionReason.trim(),
                      closeDrawer: true,
                    }).finally(() => setProcessingDetailAction(false));
                  }}
                  className="rounded-full border border-[color:var(--danger)] bg-[rgba(252,235,235,0.92)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  요청 반려
                </PermissionButton>
              </>
            ) : null}
          </>
        }
      >
        {selectedItem ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                {selectedTypeDef ? (
                  <StatusBadge label={selectedTypeDef.label} tone={selectedTypeDef.tone} />
                ) : null}
                {selectedStatusDef ? (
                  <StatusBadge label={selectedStatusDef.label} tone={selectedStatusDef.tone} />
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    자재
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--text)]">
                    {selectedItem.materialSnapshot?.description || "-"}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[color:var(--text-muted)]">
                    {selectedItem.materialSnapshot?.materialCode || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    수량
                  </div>
                  <div className="mt-2 font-mono text-sm text-[color:var(--text)]">
                    {selectedItem.transactionType === "issue"
                      ? "-"
                      : selectedItem.transactionType === "adjustment" &&
                          selectedItem.adjustmentDirection === "decrease"
                        ? "-"
                        : ""}
                    {formatIntegerDisplay(selectedItem.quantity)} {selectedItem.uom || ""}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    프로젝트
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedItem.projectSnapshot
                      ? `${selectedItem.projectSnapshot.code} · ${selectedItem.projectSnapshot.name}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    현장
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedItem.siteSnapshot
                      ? `${selectedItem.siteSnapshot.code} · ${selectedItem.siteSnapshot.name}`
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    보관위치
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedItem.storageLocation || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                    거래일
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--text)]">
                    {selectedItem.transactionDate || "-"}
                  </div>
                </div>
              </div>
            </div>

            {selectedItem.transactionType === "adjustment" ? (
              <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  조정 정보
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      조정 방향
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.adjustmentDirection === "decrease" ? "감소" : "증가"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      검토 상태
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedStatusDef?.label || "-"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[color:var(--text)]">
                  {selectedItem.adjustmentReason || "조정 사유가 없습니다."}
                </div>
              </div>
            ) : null}

            {selectedItem.transactionType === "transfer" ? (
              <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  이동 정보
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      출발 위치
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.siteSnapshot
                        ? `${selectedItem.siteSnapshot.code} · ${selectedItem.siteSnapshot.name}`
                        : "-"}{" "}
                      / {selectedItem.storageLocation || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      도착 위치
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.targetSiteSnapshot
                        ? `${selectedItem.targetSiteSnapshot.code} · ${selectedItem.targetSiteSnapshot.name}`
                        : "-"}{" "}
                      / {selectedItem.targetStorageLocation || "-"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {(selectedItem.lotNo ||
              selectedItem.serialNo ||
              selectedItem.expiryDate ||
              selectedItem.qualityStatus) ? (
              <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  재고 속성
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      Lot No.
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.lotNo || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      Serial No.
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.serialNo || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      유효기간
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.expiryDate || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      품질상태
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {getInventoryQualityLabel(selectedItem.qualityStatus)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedItem.referenceSnapshot ? (
              <div className="rounded-3xl border border-[color:var(--border)] bg-white p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                  참조 문서
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      참조번호
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.referenceSnapshot.referenceNo || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
                      참조명
                    </div>
                    <div className="mt-2 text-sm text-[color:var(--text)]">
                      {selectedItem.referenceSnapshot.referenceName || "-"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedItem.status === "rejected" && selectedItem.rejectionReason ? (
              <div className="rounded-3xl border border-[rgba(201,55,44,0.16)] bg-[rgba(252,235,235,0.72)] p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--danger)]">
                  반려 사유
                </div>
                <div className="mt-3 text-sm leading-7 text-[color:var(--text)]">
                  {selectedItem.rejectionReason}
                </div>
              </div>
            ) : null}

            {isPendingInventoryRequest ? (
              <div className="rounded-3xl border border-[rgba(161,92,7,0.16)] bg-[rgba(255,243,214,0.62)] p-5">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--warning)]">
                  재고 요청 검토
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
                  승인 시 현재고에 반영됩니다. 본인이 생성한 요청은 직접 승인할 수 없습니다. 반려하려면 사유를 반드시 입력해 주세요.
                </p>
                <div className="mt-4">
                  <FormField
                    label="반려 사유"
                    type="textarea"
                    value={rejectionReason}
                    onChange={setRejectionReason}
                    placeholder="예: 실사 근거 미첨부, 수량 근거 불명확"
                    rows={4}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
