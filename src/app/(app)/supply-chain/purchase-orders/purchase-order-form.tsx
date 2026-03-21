"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BudgetLinkFields } from "@/components/domain/budget-link-fields";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import {
  formatIntegerDisplay,
  formatIntegerInput,
  parseFormattedInteger,
} from "@/lib/number-input";

type ResolvedBudget = {
  _id: string;
  remainingAmount?: number;
};

type VendorOption = {
  _id: string;
  code: string;
  name: string;
};

type MaterialOption = {
  _id: string;
  materialCode: string;
  description: string;
  uom: string;
};

export type PurchaseOrderLine = {
  lineNo: number;
  materialId: string;
  materialSnapshot: {
    materialId: string;
    materialCode: string;
    description: string;
    uom: string;
  };
  quantity: number;
  unitPrice: number;
  lineAmount: number;
};

type PurchaseOrderLineDraft = {
  itemIndex: number | null;
  materialId: string;
  quantity: string;
  unitPrice: string;
};

export type PurchaseOrderFormInitialValues = {
  poNo: string;
  vendorId: string;
  projectId: string;
  wbsId: string;
  budgetId: string;
  orderDate: string;
  dueDate: string;
  currency: string;
  lines: PurchaseOrderLine[];
};

type PurchaseOrderFormProps = {
  mode: "create" | "edit";
  purchaseOrderId?: string;
  initialValues: PurchaseOrderFormInitialValues;
};

const emptyLineDraft: PurchaseOrderLineDraft = {
  itemIndex: null,
  materialId: "",
  quantity: "1",
  unitPrice: "",
};

export function PurchaseOrderForm({
  mode,
  purchaseOrderId,
  initialValues,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState(initialValues.vendorId);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [projectId, setProjectId] = useState(initialValues.projectId);
  const [wbsId, setWbsId] = useState(initialValues.wbsId);
  const [budgetId, setBudgetId] = useState(initialValues.budgetId);
  const [resolvedBudget, setResolvedBudget] = useState<ResolvedBudget | null>(null);
  const [lineDrawerOpen, setLineDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lineDraft, setLineDraft] = useState<PurchaseOrderLineDraft>(emptyLineDraft);
  const [lines, setLines] = useState<PurchaseOrderLine[]>(initialValues.lines);
  const [form, setForm] = useState({
    poNo: initialValues.poNo,
    orderDate: initialValues.orderDate,
    dueDate: initialValues.dueDate,
    currency: initialValues.currency || "KRW",
  });

  useEffect(() => {
    setVendorId(initialValues.vendorId);
    setProjectId(initialValues.projectId);
    setWbsId(initialValues.wbsId);
    setBudgetId(initialValues.budgetId);
    setLines(initialValues.lines);
    setForm({
      poNo: initialValues.poNo,
      orderDate: initialValues.orderDate,
      dueDate: initialValues.dueDate,
      currency: initialValues.currency || "KRW",
    });
  }, [initialValues]);

  useEffect(() => {
    let cancelled = false;

    async function fetchReferenceData() {
      try {
        const [vendorsRes, materialsRes] = await Promise.all([
          fetch("/api/vendors"),
          fetch("/api/materials"),
        ]);
        const [vendorsJson, materialsJson] = await Promise.all([
          vendorsRes.json(),
          materialsRes.json(),
        ]);
        if (!cancelled && vendorsJson.ok) {
          setVendors(vendorsJson.data.items ?? []);
        }
        if (!cancelled && materialsJson.ok) {
          setMaterials(materialsJson.data.items ?? []);
        }
      } catch {
        if (!cancelled) {
          pushToast({
            title: "기준정보 조회 실패",
            description: "공급업체 또는 자재 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
        }
      }
    }

    void fetchReferenceData();
    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const requestedAmount = lines.reduce((sum, line) => sum + line.lineAmount, 0);
  const remainingBudgetAmount = Math.max(resolvedBudget?.remainingAmount ?? 0, 0);
  const exceededAmount = Math.max(requestedAmount - remainingBudgetAmount, 0);
  const draftQuantity = parseFormattedInteger(lineDraft.quantity || "0");
  const draftUnitPrice = parseFormattedInteger(lineDraft.unitPrice || "0");
  const draftLineAmount = draftQuantity * draftUnitPrice;
  const totalAmountExcludingDraft =
    lineDraft.itemIndex === null
      ? requestedAmount
      : lines.reduce(
          (sum, line, index) => sum + (index === lineDraft.itemIndex ? 0 : line.lineAmount),
          0,
        );
  const availableBudgetForDraft = Math.max(remainingBudgetAmount - totalAmountExcludingDraft, 0);
  const draftRemainingAmount = Math.max(availableBudgetForDraft - draftLineAmount, 0);
  const draftExceedsBudget = draftLineAmount > availableBudgetForDraft;
  const isEdit = mode === "edit";

  const updateLineDraft =
    (key: keyof Omit<PurchaseOrderLineDraft, "itemIndex">) => (value: string) => {
      setLineDraft((current) => ({
        ...current,
        [key]:
          key === "quantity" || key === "unitPrice"
            ? formatIntegerInput(value)
            : value,
      }));
    };

  const closeLineDrawer = () => {
    setLineDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setLineDraft(emptyLineDraft);
  };

  const openNewLineDrawer = () => {
    if (!budgetId) {
      pushToast({
        title: "실행예산 선택 필요",
        description: "발주 라인을 추가하기 전에 프로젝트, WBS, 실행예산을 먼저 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (remainingBudgetAmount <= 0) {
      pushToast({
        title: "남은 예산 없음",
        description: "남은 예산이 없습니다. 새 발주 라인을 추가할 수 없습니다.",
        tone: "warning",
      });
      return;
    }

    setLineDraft(emptyLineDraft);
    setDeleteConfirmOpen(false);
    setLineDrawerOpen(true);
  };

  const openEditLineDrawer = (line: PurchaseOrderLine, index: number) => {
    setLineDraft({
      itemIndex: index,
      materialId: line.materialId,
      quantity: formatIntegerInput(line.quantity),
      unitPrice: formatIntegerInput(line.unitPrice),
    });
    setDeleteConfirmOpen(false);
    setLineDrawerOpen(true);
  };

  const handleSaveLine = () => {
    const selectedMaterial = materials.find((item) => item._id === lineDraft.materialId);

    if (!selectedMaterial) {
      pushToast({
        title: "자재 선택 필요",
        description: "발주 자재를 선택해 주세요.",
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

    if (draftUnitPrice < 0) {
      pushToast({
        title: "단가 확인",
        description: "단가는 0 이상이어야 합니다.",
        tone: "warning",
      });
      return;
    }

    if (draftExceedsBudget) {
      pushToast({
        title: "예산 초과",
        description: `발주 라인 금액이 남은 예산을 ${formatIntegerDisplay(draftLineAmount - availableBudgetForDraft)}원 초과했습니다.`,
        tone: "warning",
      });
      return;
    }

    const nextLine: PurchaseOrderLine = {
      lineNo: lineDraft.itemIndex === null ? lines.length + 1 : lineDraft.itemIndex + 1,
      materialId: selectedMaterial._id,
      materialSnapshot: {
        materialId: selectedMaterial._id,
        materialCode: selectedMaterial.materialCode,
        description: selectedMaterial.description,
        uom: selectedMaterial.uom,
      },
      quantity: draftQuantity,
      unitPrice: draftUnitPrice,
      lineAmount: draftLineAmount,
    };

    setLines((current) => {
      const nextLines =
        lineDraft.itemIndex === null
          ? [...current, nextLine]
          : current.map((line, index) => (index === lineDraft.itemIndex ? nextLine : line));

      return nextLines.map((line, index) => ({
        ...line,
        lineNo: index + 1,
      }));
    });
    closeLineDrawer();
  };

  const handleDeleteLine = () => {
    if (lineDraft.itemIndex === null) {
      return;
    }

    setLines((current) =>
      current
        .filter((_line, index) => index !== lineDraft.itemIndex)
        .map((line, index) => ({
          ...line,
          lineNo: index + 1,
        })),
    );
    closeLineDrawer();
  };

  const handleSubmit = async () => {
    if (
      !vendorId ||
      !projectId ||
      !wbsId ||
      !budgetId ||
      !form.orderDate ||
      !form.dueDate ||
      lines.length === 0
    ) {
      pushToast({
        title: "필수 입력",
        description: "공급업체, 프로젝트, WBS, 실행예산, 발주일, 납기일, 발주 라인을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (requestedAmount > remainingBudgetAmount) {
      pushToast({
        title: "예산 초과",
        description: `발주 총액이 남은 예산을 ${formatIntegerDisplay(exceededAmount)}원 초과했습니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const endpoint =
        isEdit && purchaseOrderId
          ? `/api/purchase-orders/${purchaseOrderId}`
          : "/api/purchase-orders/create";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNo: form.poNo,
          vendorId,
          projectId,
          wbsId,
          budgetId,
          orderDate: form.orderDate,
          dueDate: form.dueDate,
          currency: form.currency,
          lines: lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        }),
      });
      const json = await res.json();

      if (json.ok) {
        pushToast({
          title: isEdit ? "수정 완료" : "등록 완료",
          description: isEdit ? "발주를 수정했습니다." : "발주가 등록되었습니다.",
          tone: "success",
        });
        router.push(
          isEdit && purchaseOrderId
            ? `/supply-chain/purchase-orders/${purchaseOrderId}`
            : "/supply-chain/purchase-orders",
        );
        return;
      }

      pushToast({
        title: isEdit ? "수정 실패" : "등록 실패",
        description: json.message || "발주를 저장하지 못했습니다.",
        tone: "warning",
      });
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

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title={isEdit ? `${form.poNo} 수정` : "발주 등록"}
        description={
          isEdit
            ? "공급업체, 실행예산 연결, 발주 라인을 수정합니다."
            : "발주와 실행예산 연결 정보를 함께 등록합니다."
        }
        actions={
          <>
            <Link
              href={
                isEdit && purchaseOrderId
                  ? `/supply-chain/purchase-orders/${purchaseOrderId}`
                  : "/supply-chain/purchase-orders"
              }
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
              {saving ? (isEdit ? "수정 중..." : "저장 중...") : isEdit ? "수정 저장" : "저장"}
            </button>
          </>
        }
      />

      <Panel className="p-5">
        <BudgetLinkFields
          projectId={projectId}
          wbsId={wbsId}
          budgetId={budgetId}
          onProjectChange={setProjectId}
          onWbsChange={setWbsId}
          onBudgetChange={setBudgetId}
          onBudgetResolved={setResolvedBudget}
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="공급업체"
            required
            type="select"
            value={vendorId}
            onChange={setVendorId}
            options={vendors.map((vendor) => ({
              value: vendor._id,
              label: `${vendor.code} · ${vendor.name}`,
            }))}
          />
          <FormField label="발주번호" required type="readonly" value={form.poNo} />
          <DatePicker label="발주일" required value={form.orderDate} onChange={update("orderDate")} />
          <DatePicker label="납기일" required value={form.dueDate} onChange={update("dueDate")} />
          <FormField
            label="발주 총액"
            type="readonly"
            value={formatIntegerDisplay(requestedAmount)}
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
        </div>
        {budgetId ? (
          exceededAmount > 0 ? (
            <p className="mt-4 text-sm font-medium text-[color:var(--danger)]">
              입력한 발주 총액이 남은 예산을 {formatIntegerDisplay(exceededAmount)}원 초과했습니다.
            </p>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">
              현재 이 실행예산 버전에서 추가 등록 가능한 금액은 {formatIntegerDisplay(remainingBudgetAmount)}원입니다.
            </p>
          )
        ) : null}
      </Panel>

      <div className="mt-6">
        <DataTable
          title="발주 라인"
          description="자재, 수량, 단가를 기준으로 발주 총액을 자동 계산합니다."
          actions={
            <button
              type="button"
              onClick={openNewLineDrawer}
              disabled={!budgetId || remainingBudgetAmount <= 0}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              발주 라인 추가
            </button>
          }
          columns={[
            { key: "lineNo", label: "No." },
            { key: "materialCode", label: "자재코드" },
            { key: "description", label: "자재명" },
            { key: "uom", label: "단위" },
            { key: "quantity", label: "수량", align: "right" },
            { key: "unitPrice", label: "단가", align: "right" },
            { key: "lineAmount", label: "금액", align: "right" },
          ]}
          rows={lines.map((line, index) => ({
            id: `po-line-${index}`,
            itemIndex: index,
            descriptionValue: line.materialSnapshot.description,
            lineNo: <span className="font-mono">{formatIntegerDisplay(line.lineNo)}</span>,
            materialCode: (
              <span className="font-mono text-[color:var(--primary)]">
                {line.materialSnapshot.materialCode}
              </span>
            ),
            description: line.materialSnapshot.description,
            uom: line.materialSnapshot.uom || "-",
            quantity: <span className="font-mono">{formatIntegerDisplay(line.quantity)}</span>,
            unitPrice: <span className="font-mono">₩ {formatIntegerDisplay(line.unitPrice)}</span>,
            lineAmount: <span className="font-mono">₩ {formatIntegerDisplay(line.lineAmount)}</span>,
          }))}
          getRowKey={(row) => String(row.id)}
          onRowClick={(row) => {
            const itemIndex = Number(row.itemIndex);
            const targetLine = lines[itemIndex];
            if (targetLine) {
              openEditLineDrawer(targetLine, itemIndex);
            }
          }}
          getRowAriaLabel={(row) => `${String(row.descriptionValue)} 발주 라인 편집 열기`}
          emptyState={{
            title: "등록된 발주 라인이 없습니다",
            description: "발주 라인을 추가하면 총액이 자동으로 계산됩니다.",
            action: (
              <button
                type="button"
                onClick={openNewLineDrawer}
                disabled={!budgetId || remainingBudgetAmount <= 0}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                발주 라인 추가
              </button>
            ),
          }}
        />
      </div>

      <Drawer
        open={lineDrawerOpen}
        onClose={closeLineDrawer}
        eyebrow="Purchase Order"
        title={lineDraft.itemIndex === null ? "발주 라인 추가" : "발주 라인 수정"}
        description="자재, 수량, 단가를 입력하면 금액이 자동 계산되고 선택한 실행예산의 남은 금액을 초과할 수 없습니다."
        footer={
          <>
            {lineDraft.itemIndex !== null ? (
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
              onClick={closeLineDrawer}
              disabled={saving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveLine}
              disabled={saving || draftExceedsBudget}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {lineDraft.itemIndex === null ? "추가 저장" : "수정 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="자재"
            required
            type="select"
            value={lineDraft.materialId}
            onChange={updateLineDraft("materialId")}
            options={materials.map((material) => ({
              value: material._id,
              label: `${material.materialCode} · ${material.description}`,
            }))}
          />
          <FormField
            label="수량"
            required
            type="text"
            inputMode="numeric"
            value={lineDraft.quantity}
            onChange={updateLineDraft("quantity")}
            placeholder="1"
          />
          <FormField
            label="단가"
            required
            type="text"
            inputMode="numeric"
            value={lineDraft.unitPrice}
            onChange={updateLineDraft("unitPrice")}
            placeholder="0"
          />
          <FormField label="금액" type="readonly" value={formatIntegerDisplay(draftLineAmount)} />
          <FormField
            label="편집 가능 예산"
            type="readonly"
            value={formatIntegerDisplay(availableBudgetForDraft)}
          />
          <FormField
            label="저장 후 남은 예산"
            type="readonly"
            value={formatIntegerDisplay(draftRemainingAmount)}
          />
          {draftExceedsBudget ? (
            <p className="rounded-2xl border border-[rgba(201,55,44,0.18)] bg-[rgba(255,235,230,0.92)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]">
              입력한 금액이 남은 예산을 {formatIntegerDisplay(draftLineAmount - availableBudgetForDraft)}원 초과했습니다.
            </p>
          ) : null}
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="발주 라인을 삭제할까요?"
        description="선택한 발주 라인은 현재 발주서에서 제거됩니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteLine}
      />
    </>
  );
}
