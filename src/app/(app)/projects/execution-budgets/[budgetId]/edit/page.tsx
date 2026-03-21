"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import {
  executionBudgetCostCategoryOptions,
  getExecutionBudgetCostCategoryLabel,
} from "@/lib/execution-budget-cost-categories";
import { getNextExecutionBudgetVersion, normalizeExecutionBudgetVersion } from "@/lib/execution-budget-version";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ExecutionBudgetCostItem = {
  costCategory: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type ExecutionBudgetDetail = {
  _id: string;
  budgetCode?: string;
  projectSnapshot: { name: string } | null;
  wbsSnapshot: { code: string; name: string } | null;
  version: string;
  currency: string;
  totalAmount: number;
  effectiveDate: string;
  costItems: ExecutionBudgetCostItem[];
};

type CostItemDraft = {
  itemIndex: number | null;
  costCategory: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const emptyCostItemDraft: CostItemDraft = {
  itemIndex: null,
  costCategory: "general",
  description: "",
  quantity: "1",
  unitPrice: "",
};

function buildCostCategoryOptions(currentValue: string) {
  const hasCurrentValue = executionBudgetCostCategoryOptions.some(
    (option) => option.value === currentValue,
  );

  if (!currentValue || hasCurrentValue) {
    return [...executionBudgetCostCategoryOptions];
  }

  return [
    { label: currentValue, value: currentValue },
    ...executionBudgetCostCategoryOptions,
  ];
}

export default function ExecutionBudgetEditPage() {
  const router = useRouter();
  const { budgetId } = useParams<{ budgetId: string }>();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costItemDrawerOpen, setCostItemDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [costItemDraft, setCostItemDraft] = useState<CostItemDraft>(emptyCostItemDraft);
  const [form, setForm] = useState({
    budgetCode: "",
    wbsLabel: "",
    currentVersion: "",
    nextVersion: "",
    currency: "KRW",
    effectiveDate: "",
    totalAmount: "",
  });
  const [costItems, setCostItems] = useState<ExecutionBudgetCostItem[]>([]);

  const budgetLimit = parseFormattedInteger(form.totalAmount || "0");
  const allocatedAmount = costItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingAmount = Math.max(budgetLimit - allocatedAmount, 0);
  const exceededAmount = Math.max(allocatedAmount - budgetLimit, 0);
  const additionBlocked = remainingAmount <= 0;
  const draftQuantity = parseFormattedInteger(costItemDraft.quantity || "0");
  const draftUnitPrice = parseFormattedInteger(costItemDraft.unitPrice || "0");
  const draftAmount = draftQuantity * draftUnitPrice;
  const allocatedAmountExcludingDraft =
    costItemDraft.itemIndex === null
      ? allocatedAmount
      : costItems.reduce(
          (sum, item, index) => sum + (index === costItemDraft.itemIndex ? 0 : item.amount),
          0,
        );
  const availableBudgetForDraft = Math.max(budgetLimit - allocatedAmountExcludingDraft, 0);
  const draftRemainingAmount = Math.max(availableBudgetForDraft - draftAmount, 0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/execution-budgets/${budgetId}`);
        const json = await res.json();

        if (!json.ok) {
          setError(json.message || "실행예산을 불러오지 못했습니다.");
          return;
        }

        const doc = json.data as ExecutionBudgetDetail;
        const currentVersion = normalizeExecutionBudgetVersion(doc.version);
        setForm({
          budgetCode: typeof doc.budgetCode === "string" ? doc.budgetCode : "",
          wbsLabel: doc.wbsSnapshot ? `${doc.wbsSnapshot.name} (${doc.wbsSnapshot.code})` : "-",
          currentVersion,
          nextVersion: getNextExecutionBudgetVersion(currentVersion),
          currency: doc.currency || "KRW",
          effectiveDate: doc.effectiveDate || "",
          totalAmount: formatIntegerInput(doc.totalAmount),
        });
        setCostItems(Array.isArray(doc.costItems) ? doc.costItems : []);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [budgetId]);

  const update = (key: "currency" | "effectiveDate" | "totalAmount") => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "totalAmount" ? formatIntegerInput(value) : value,
    }));
  };

  const updateCostItemDraft =
    (key: keyof Omit<CostItemDraft, "itemIndex">) => (value: string) => {
      setCostItemDraft((current) => ({
        ...current,
        [key]:
          key === "quantity" || key === "unitPrice"
            ? formatIntegerInput(value)
            : value,
      }));
    };

  const closeCostItemDrawer = () => {
    setCostItemDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setCostItemDraft(emptyCostItemDraft);
  };

  const openNewCostItemDrawer = () => {
    if (additionBlocked) {
      pushToast({
        title: "남은 예산 없음",
        description: "남은 예산이 없습니다. 원가항목을 추가할 수 없습니다.",
        tone: "warning",
      });
      return;
    }

    setCostItemDraft(emptyCostItemDraft);
    setDeleteConfirmOpen(false);
    setCostItemDrawerOpen(true);
  };

  const openEditCostItemDrawer = (item: ExecutionBudgetCostItem, index: number) => {
    setCostItemDraft({
      itemIndex: index,
      costCategory: item.costCategory,
      description: item.description,
      quantity: formatIntegerInput(item.quantity),
      unitPrice: formatIntegerInput(item.unitPrice),
    });
    setDeleteConfirmOpen(false);
    setCostItemDrawerOpen(true);
  };

  const handleSaveCostItem = () => {
    if (!costItemDraft.description.trim()) {
      pushToast({
        title: "필수 입력",
        description: "원가항목 설명을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (draftQuantity <= 0) {
      pushToast({
        title: "수량 확인",
        description: "수량은 1 이상이어야 합니다.",
        tone: "warning",
      });
      return;
    }

    if (draftAmount > availableBudgetForDraft) {
      pushToast({
        title: "예산 초과",
        description: `남은 예산 ${availableBudgetForDraft.toLocaleString()}원을 초과해 등록할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    const nextItem: ExecutionBudgetCostItem = {
      costCategory: costItemDraft.costCategory,
      description: costItemDraft.description.trim(),
      quantity: draftQuantity,
      unitPrice: draftUnitPrice,
      amount: draftAmount,
    };

    setCostItems((current) =>
      costItemDraft.itemIndex === null
        ? [nextItem, ...current]
        : current.map((item, index) => (index === costItemDraft.itemIndex ? nextItem : item)),
    );

    closeCostItemDrawer();
  };

  const handleDeleteCostItem = () => {
    if (costItemDraft.itemIndex === null) {
      return;
    }

    setCostItems((current) =>
      current.filter((_item, index) => index !== costItemDraft.itemIndex),
    );
    closeCostItemDrawer();
  };

  const handleSubmit = async () => {
    if (!form.effectiveDate) {
      pushToast({
        title: "필수 입력",
        description: "적용일을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (costItems.length === 0) {
      pushToast({
        title: "원가항목 필요",
        description: "최소 1개 이상의 원가항목을 등록해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (allocatedAmount > budgetLimit) {
      pushToast({
        title: "예산 초과",
        description: `원가항목 합계가 총 예산액을 ${exceededAmount.toLocaleString()}원 초과했습니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/execution-budgets/${budgetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: form.currency,
          effectiveDate: form.effectiveDate,
          costItems,
          totalAmount: budgetLimit,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "수정 실패",
          description: json.message || "실행예산을 수정하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "수정 완료",
        description: `${form.nextVersion}로 버전이 상승했습니다.`,
        tone: "success",
      });
      router.push(`/projects/execution-budgets/${budgetId}`);
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="실행예산 로딩 중"
        description="수정할 실행예산 정보를 불러오고 있습니다."
      />
    );
  }

  if (error) {
    return <StatePanel variant="error" title="실행예산 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="실행예산 수정"
        description="총 예산액과 원가항목을 함께 조정할 수 있고, 저장 시 버전이 한 단계 올라갑니다."
        actions={
          <>
            <Link
              href={`/projects/execution-budgets/${budgetId}`}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="예산코드" type="readonly" value={form.budgetCode || "-"} />
            <FormField label="WBS" type="readonly" value={form.wbsLabel} />
            <FormField label="현재 버전" type="readonly" value={form.currentVersion} />
            <FormField label="저장 후 버전" type="readonly" value={form.nextVersion} />
          </div>
        </Panel>

        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">예산 값</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="통화"
              type="select"
              value={form.currency}
              onChange={update("currency")}
              options={[
                { label: "KRW", value: "KRW" },
                { label: "USD", value: "USD" },
              ]}
            />
            <DatePicker label="적용일" required value={form.effectiveDate} onChange={update("effectiveDate")} />
            <FormField
              label="총 예산액"
              required
              type="text"
              inputMode="numeric"
              value={form.totalAmount}
              onChange={update("totalAmount")}
              placeholder="0"
            />
            <FormField label="배정 합계" type="readonly" value={allocatedAmount.toLocaleString()} />
            <FormField label="남은 예산" type="readonly" value={remainingAmount.toLocaleString()} />
            <FormField label="원가항목 수" type="readonly" value={costItems.length.toLocaleString()} />
          </div>
          {exceededAmount > 0 ? (
            <p className="mt-4 rounded-2xl border border-[rgba(201,55,44,0.18)] bg-[rgba(255,235,230,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]">
              현재 배정 합계가 총 예산액을 {exceededAmount.toLocaleString()}원 초과했습니다. 총 예산액을 늘리거나 기존 원가항목을 조정한 뒤 저장해 주세요.
            </p>
          ) : null}
          {additionBlocked && exceededAmount === 0 ? (
            <p className="mt-4 rounded-2xl border border-[rgba(161,92,7,0.18)] bg-[rgba(255,243,214,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--warning)]">
              남은 예산이 없습니다. 기존 원가항목은 수정할 수 있지만 새 원가항목은 추가할 수 없습니다.
            </p>
          ) : null}
        </Panel>
      </div>

      <div className="mt-6">
        <DataTable
          title="원가항목"
          description={`행을 눌러 수정하고, 총 예산액 ${budgetLimit.toLocaleString()}원 기준으로 배정 상태를 관리합니다.`}
          actions={
            <button
              type="button"
              onClick={openNewCostItemDrawer}
              disabled={additionBlocked}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              원가항목 추가
            </button>
          }
          columns={[
            { key: "costCategory", label: "원가구분" },
            { key: "description", label: "설명" },
            { key: "quantity", label: "수량", align: "right" },
            { key: "unitPrice", label: "단가", align: "right" },
            { key: "amount", label: "금액", align: "right" },
          ]}
          rows={costItems.map((item, index) => ({
            id: `cost-item-${index}`,
            itemIndex: index,
            descriptionValue: item.description,
            costCategory: <span className="font-medium">{getExecutionBudgetCostCategoryLabel(item.costCategory)}</span>,
            description: item.description,
            quantity: <span className="font-mono">{item.quantity.toLocaleString()}</span>,
            unitPrice: <span className="font-mono">₩ {item.unitPrice.toLocaleString()}</span>,
            amount: <span className="font-mono">₩ {item.amount.toLocaleString()}</span>,
          }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            const itemIndex = Number(row.itemIndex);
            const item = costItems[itemIndex];
            if (item) {
              openEditCostItemDrawer(item, itemIndex);
            }
          }}
          getRowAriaLabel={(row) => `${String(row.descriptionValue)} 원가항목 편집 열기`}
          emptyState={{
            title: "등록된 원가항목이 없습니다",
            description: "원가항목 추가로 실행예산의 세부 항목을 구성해 주세요.",
            action: (
              <button
                type="button"
                onClick={openNewCostItemDrawer}
                disabled={additionBlocked}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                원가항목 추가
              </button>
            ),
          }}
        />
      </div>

      <Drawer
        open={costItemDrawerOpen}
        onClose={closeCostItemDrawer}
        eyebrow="Cost Item"
        title={costItemDraft.itemIndex === null ? "원가항목 추가" : "원가항목 수정"}
        description="원가구분, 설명, 수량, 단가를 입력하면 금액은 자동 계산되고 남은 예산을 초과할 수 없습니다."
        footer={
          <>
            {costItemDraft.itemIndex !== null ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={saving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeCostItemDrawer}
              disabled={saving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveCostItem}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {costItemDraft.itemIndex === null ? "추가 저장" : "수정 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="원가구분"
            type="select"
            value={costItemDraft.costCategory}
            onChange={updateCostItemDraft("costCategory")}
            options={buildCostCategoryOptions(costItemDraft.costCategory)}
          />
          <FormField
            label="설명"
            required
            value={costItemDraft.description}
            onChange={updateCostItemDraft("description")}
            placeholder="예: 메인 배관 자재"
          />
          <FormField
            label="수량"
            required
            type="text"
            inputMode="numeric"
            value={costItemDraft.quantity}
            onChange={updateCostItemDraft("quantity")}
            placeholder="1"
          />
          <FormField
            label="단가"
            required
            type="text"
            inputMode="numeric"
            value={costItemDraft.unitPrice}
            onChange={updateCostItemDraft("unitPrice")}
            placeholder="0"
          />
          <FormField label="금액" type="readonly" value={draftAmount.toLocaleString()} />
          <FormField label="편집 가능 예산" type="readonly" value={availableBudgetForDraft.toLocaleString()} />
          <FormField label="저장 후 남은 예산" type="readonly" value={draftRemainingAmount.toLocaleString()} />
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="원가항목을 삭제할까요?"
        description="선택한 원가항목은 현재 예산안에서 제거됩니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteCostItem}
      />
    </>
  );
}
