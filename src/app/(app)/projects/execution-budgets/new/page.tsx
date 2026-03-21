"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { generateExecutionBudgetCode } from "@/lib/document-numbers";
import {
  executionBudgetCostCategoryOptions,
  getExecutionBudgetCostCategoryLabel,
} from "@/lib/execution-budget-cost-categories";
import { getInitialExecutionBudgetVersion } from "@/lib/execution-budget-version";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";
import { DatePicker } from "@/components/ui/date-picker";

type WbsOption = {
  _id: string;
  code: string;
  name: string;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
};

type ExecutionBudgetCostItem = {
  costCategory: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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

export default function ExecutionBudgetNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const { currentProjectId } = useProjectSelection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costItemDrawerOpen, setCostItemDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [wbsOptions, setWbsOptions] = useState<WbsOption[]>([]);
  const [costItemDraft, setCostItemDraft] = useState<CostItemDraft>(emptyCostItemDraft);
  const [form, setForm] = useState({
    budgetCode: "",
    wbsId: "",
    version: getInitialExecutionBudgetVersion(),
    currency: "KRW",
    effectiveDate: "",
    totalAmount: "",
  });
  const [costItems, setCostItems] = useState<ExecutionBudgetCostItem[]>([]);

  const budgetLimit = parseFormattedInteger(form.totalAmount || "0");
  const allocatedAmount = costItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingAmount = Math.max(budgetLimit - allocatedAmount, 0);
  const exceededAmount = Math.max(allocatedAmount - budgetLimit, 0);
  const canAddCostItem = budgetLimit > 0 && remainingAmount > 0;
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
  const draftExceedsBudget = draftAmount > availableBudgetForDraft;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [wbsRes] = await Promise.all([
          fetch(appendProjectIdToPath("/api/projects/wbs", currentProjectId)),
        ]);
        const wbsJson = await wbsRes.json();

        if (!wbsJson.ok) {
          setError(wbsJson.message || "WBS 목록을 불러오지 못했습니다.");
          return;
        }

        setWbsOptions(wbsJson.data.items);
        setForm((prev) => ({
          ...prev,
          budgetCode: generateExecutionBudgetCode(),
          version: getInitialExecutionBudgetVersion(),
          wbsId:
            currentProjectId && wbsJson.data.items.length === 1
              ? wbsJson.data.items[0]?._id ?? ""
              : prev.wbsId,
        }));
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [currentProjectId]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "totalAmount"
          ? formatIntegerInput(value)
          : value,
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
    if (budgetLimit <= 0) {
      pushToast({
        title: "총 예산액 필요",
        description: "원가항목을 추가하기 전에 총 예산액을 먼저 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (remainingAmount <= 0) {
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
    if (!form.wbsId || !form.effectiveDate || !form.totalAmount) {
      pushToast({
        title: "필수 입력",
        description: "WBS, 적용일, 총 예산액을 확인해 주세요.",
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
      const res = await fetch("/api/execution-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wbsId: form.wbsId,
          currency: form.currency,
          effectiveDate: form.effectiveDate,
          totalAmount: budgetLimit,
          costItems,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "실행예산을 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "실행예산이 v1.0으로 등록되었습니다.",
        tone: "success",
      });
      router.push("/projects/execution-budgets");
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
        title="실행예산 등록 준비 중"
        description="WBS 목록과 기본 코드를 불러오고 있습니다."
      />
    );
  }

  if (error) {
    return <StatePanel variant="error" title="실행예산 등록 준비 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="실행예산 등록"
        description="WBS 기준 실행예산과 원가항목을 함께 등록합니다. 최초 등록 버전은 v1.0입니다."
        actions={
          <>
            <Link
              href="/projects/execution-budgets"
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

      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="예산코드" type="readonly" value={form.budgetCode} />
          <FormField label="버전" type="readonly" value={form.version} />
          <FormField
            label="WBS"
            required
            type="select"
            value={form.wbsId}
            onChange={update("wbsId")}
            options={wbsOptions.map((item) => ({
              label: currentProjectId
                ? `${item.name} (${item.code})`
                : `${item.projectSnapshot?.name || "프로젝트"} · ${item.name} (${item.code})`,
              value: item._id,
            }))}
          />
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
        </div>
        {budgetLimit <= 0 ? (
          <p className="mt-4 rounded-2xl border border-[rgba(161,92,7,0.18)] bg-[rgba(255,243,214,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--warning)]">
            총 예산액을 먼저 입력하면 원가항목을 추가할 수 있습니다.
          </p>
        ) : null}
        {exceededAmount > 0 ? (
          <p className="mt-4 rounded-2xl border border-[rgba(201,55,44,0.18)] bg-[rgba(255,235,230,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]">
            현재 배정 합계가 총 예산액을 {exceededAmount.toLocaleString()}원 초과했습니다. 총 예산액을 늘리거나 원가항목을 조정해 주세요.
          </p>
        ) : null}
        {budgetLimit > 0 && remainingAmount <= 0 && exceededAmount === 0 ? (
          <p className="mt-4 rounded-2xl border border-[rgba(161,92,7,0.18)] bg-[rgba(255,243,214,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--warning)]">
            남은 예산이 없습니다. 기존 원가항목은 수정할 수 있지만 새 원가항목은 추가할 수 없습니다.
          </p>
        ) : null}
      </Panel>

      <div className="mt-6">
        <DataTable
          title="원가항목"
          description={`총 예산액 ${budgetLimit.toLocaleString()}원 기준으로 원가항목을 바로 등록할 수 있습니다.`}
          actions={
            <button
              type="button"
              onClick={openNewCostItemDrawer}
              disabled={!canAddCostItem}
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
                disabled={!canAddCostItem}
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
              disabled={saving || draftExceedsBudget}
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
            options={[...executionBudgetCostCategoryOptions]}
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
          {draftExceedsBudget ? (
            <p className="rounded-2xl border border-[rgba(201,55,44,0.18)] bg-[rgba(255,235,230,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]">
              입력한 금액이 남은 예산을 {(draftAmount - availableBudgetForDraft).toLocaleString()}원 초과했습니다. 총 예산액을 늘리거나 수량·단가를 조정해 주세요.
            </p>
          ) : null}
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
