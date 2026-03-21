"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast-provider";
import { appendProjectIdToPath } from "@/lib/project-scope";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type Option = {
  value: string;
  label: string;
  uom?: string;
};

type InventorySummaryOption = {
  materialId: string;
  siteId: string;
  storageLocation: string;
  currentQuantity: number;
  uom: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
};

const transactionTypeOptions = [
  { value: "receipt", label: "입고" },
  { value: "issue", label: "출고" },
  { value: "transfer", label: "이동" },
  { value: "return", label: "반품" },
  { value: "adjustment", label: "조정" },
];
const adjustmentDirectionOptions = [
  { value: "increase", label: "증가" },
  { value: "decrease", label: "감소" },
];
const qualityStatusOptions = [
  { value: "available", label: "가용" },
  { value: "quality-hold", label: "품질보류" },
  { value: "blocked", label: "사용중지" },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewInventoryTransactionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { currentProjectId, projects, projectsLoading } = useProjectSelection();
  const [saving, setSaving] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [siteOptions, setSiteOptions] = useState<Option[]>([]);
  const [materialOptions, setMaterialOptions] = useState<Option[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryOption[]>([]);
  const [form, setForm] = useState({
    projectId: "",
    siteId: "",
    targetSiteId: "",
    materialId: "",
    storageLocation: "",
    targetStorageLocation: "",
    transactionType: "receipt",
    adjustmentDirection: "increase",
    adjustmentReason: "",
    quantity: "",
    transactionDate: getToday(),
    referenceType: "",
    referenceNo: "",
    referenceName: "",
    lotNo: "",
    serialNo: "",
    expiryDate: "",
    qualityStatus: "available",
  });

  useEffect(() => {
    const nextValues: Partial<typeof form> = {};
    const typeParam = searchParams.get("type");
    if (typeParam) {
      const normalizedType = transactionTypeOptions.some((option) => option.value === typeParam)
        ? typeParam
        : null;
      if (normalizedType) {
        nextValues.transactionType = normalizedType;
      }
    }

    const projectIdParam = searchParams.get("projectId");
    if (projectIdParam) {
      nextValues.projectId = projectIdParam;
    }

    const siteIdParam = searchParams.get("siteId");
    if (siteIdParam) {
      nextValues.siteId = siteIdParam;
    }

    const materialIdParam = searchParams.get("materialId");
    if (materialIdParam) {
      nextValues.materialId = materialIdParam;
    }

    const storageLocationParam = searchParams.get("storageLocation");
    if (storageLocationParam) {
      nextValues.storageLocation = storageLocationParam;
    }

    const lotNoParam = searchParams.get("lotNo");
    if (lotNoParam) {
      nextValues.lotNo = lotNoParam;
    }

    const serialNoParam = searchParams.get("serialNo");
    if (serialNoParam) {
      nextValues.serialNo = serialNoParam;
    }

    const expiryDateParam = searchParams.get("expiryDate");
    if (expiryDateParam) {
      nextValues.expiryDate = expiryDateParam;
    }

    const qualityStatusParam = searchParams.get("qualityStatus");
    if (qualityStatusParam) {
      nextValues.qualityStatus = qualityStatusParam;
    }

    if (Object.keys(nextValues).length === 0) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...nextValues,
    }));
  }, [searchParams]);

  useEffect(() => {
    setForm((current) => {
      if (current.projectId || !currentProjectId) {
        return current;
      }

      return {
        ...current,
        projectId: currentProjectId,
      };
    });
  }, [currentProjectId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMaterials() {
      setMaterialsLoading(true);
      try {
        const response = await fetch("/api/inventory/options", {
          signal: controller.signal,
        });
        const json = await response.json();
        if (!controller.signal.aborted && json.ok) {
          setMaterialOptions(json.data.materials ?? []);
        }
      } catch {
        if (!controller.signal.aborted) {
          pushToast({
            title: "자재 조회 실패",
            description: "재고 거래 등록에 필요한 자재 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setMaterialsLoading(false);
        }
      }
    }

    void loadMaterials();
    return () => controller.abort();
  }, [pushToast]);

  useEffect(() => {
    if (!form.projectId) {
      setSiteOptions([]);
      setInventorySummary([]);
      setForm((current) => ({ ...current, siteId: "", targetSiteId: "" }));
      return;
    }

    const controller = new AbortController();

    async function loadSites() {
      setSitesLoading(true);
      try {
        const response = await fetch(
          appendProjectIdToPath("/api/inventory/options", form.projectId),
          { signal: controller.signal },
        );
        const json = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        if (!json.ok) {
          pushToast({
            title: "현장 조회 실패",
            description: json.message || "현장 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
          setSiteOptions([]);
          return;
        }

        const nextSites = json.data.sites ?? [];
        setInventorySummary(json.data.summary ?? []);
        setSiteOptions(nextSites);
        setForm((current) => ({
          ...current,
          siteId:
            nextSites.some((site: Option) => site.value === current.siteId)
              ? current.siteId
              : nextSites[0]?.value ?? "",
          targetSiteId:
            nextSites.some((site: Option) => site.value === current.targetSiteId)
              ? current.targetSiteId
              : nextSites[0]?.value ?? "",
        }));
      } catch {
        if (!controller.signal.aborted) {
          pushToast({
            title: "현장 조회 실패",
            description: "현장 목록을 불러오는 중 오류가 발생했습니다.",
            tone: "warning",
          });
          setSiteOptions([]);
          setInventorySummary([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSitesLoading(false);
        }
      }
    }

    void loadSites();
    return () => controller.abort();
  }, [form.projectId, pushToast]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project._id,
        label: `${project.code} · ${project.name}`,
      })),
    [projects],
  );
  const requestedQuantity = parseFormattedInteger(form.quantity);
  const isTransfer = form.transactionType === "transfer";
  const isAdjustment = form.transactionType === "adjustment";
  const isReducingTransaction =
    form.transactionType === "issue" ||
    form.transactionType === "transfer" ||
    (isAdjustment && form.adjustmentDirection === "decrease");
  const normalizedStorageLocation = form.storageLocation.trim().toLowerCase();
  const selectedMaterial = materialOptions.find((item) => item.value === form.materialId);
  const selectedStock = inventorySummary.find(
    (item) =>
      item.materialId === form.materialId &&
      item.siteId === form.siteId &&
      item.storageLocation.trim().toLowerCase() === normalizedStorageLocation &&
      item.lotNo === form.lotNo &&
      item.serialNo === form.serialNo &&
      item.expiryDate === form.expiryDate &&
      item.qualityStatus === form.qualityStatus,
  );
  const availableQuantity = selectedStock?.currentQuantity ?? 0;
  const availableUom = selectedStock?.uom || selectedMaterial?.uom || "";
  const canEvaluateAvailability =
    Boolean(form.materialId) && Boolean(form.siteId) && normalizedStorageLocation.length > 0;
  const exceedsAvailableQuantity =
    isReducingTransaction && canEvaluateAvailability && requestedQuantity > availableQuantity;
  const projectedQuantity = canEvaluateAvailability
    ? isReducingTransaction
      ? availableQuantity - requestedQuantity
      : availableQuantity + requestedQuantity
    : 0;
  const stockSummaryTitle = isTransfer
    ? "재고 이동 기준 수량"
    : form.transactionType === "issue"
      ? "출고 기준 수량"
      : form.transactionType === "adjustment"
        ? "조정 기준 수량"
        : form.transactionType === "return"
          ? "반품 기준 수량"
          : "입고 기준 수량";

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === "quantity" ? formatIntegerInput(value) : value,
    }));
  }

  async function handleSubmit() {
    if (
      !form.projectId ||
      !form.siteId ||
      !form.materialId ||
      !form.storageLocation.trim() ||
      (isTransfer && (!form.targetSiteId || !form.targetStorageLocation.trim())) ||
      (isAdjustment && !form.adjustmentReason.trim()) ||
      !form.transactionDate ||
      requestedQuantity <= 0
    ) {
      pushToast({
        title: "필수 입력 확인",
        description: isTransfer
          ? "프로젝트, 출발/도착 현장, 자재, 출발/도착 보관위치, 거래일, 수량을 모두 입력해 주세요."
          : isAdjustment
            ? "프로젝트, 현장, 자재, 보관위치, 조정 방향, 조정 사유, 거래일, 수량을 모두 입력해 주세요."
          : "프로젝트, 현장, 자재, 보관위치, 거래일, 수량을 모두 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (exceedsAvailableQuantity) {
      pushToast({
        title: "현재고 초과",
        description: `선택한 위치의 현재고 ${formatIntegerInput(String(availableQuantity))} ${availableUom}를 초과할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: requestedQuantity,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "재고 거래 등록 실패",
          description: json.message || "재고 거래를 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "재고 거래 등록 완료",
        description:
          form.transactionType === "receipt" || form.transactionType === "return"
            ? "재고 거래를 반영했습니다."
            : "재고 요청을 저장했습니다.",
        tone: "success",
      });
      router.push("/supply-chain/inventory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title="재고 거래 등록"
        description="재고는 수정/삭제 대신 입고, 출고, 반품, 조정 거래를 추가해 이력으로 관리합니다."
        actions={
          <Link
            href="/supply-chain/inventory"
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
          >
            목록으로
          </Link>
        }
      />
      <Panel className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="프로젝트"
            required
            type="select"
            value={form.projectId}
            onChange={(value) => updateField("projectId", value)}
            options={projectOptions}
          />
          <FormField
            label={isTransfer ? "출발 현장" : "현장"}
            required
            type="select"
            value={form.siteId}
            onChange={(value) => updateField("siteId", value)}
            options={siteOptions}
          />
          <FormField
            label="자재"
            required
            type="select"
            value={form.materialId}
            onChange={(value) => updateField("materialId", value)}
            options={materialOptions}
          />
          <FormField
            label="거래유형"
            required
            type="select"
            value={form.transactionType}
            onChange={(value) => updateField("transactionType", value)}
            options={transactionTypeOptions}
          />
          {isAdjustment ? (
            <FormField
              label="조정 방향"
              required
              type="select"
              value={form.adjustmentDirection}
              onChange={(value) => updateField("adjustmentDirection", value)}
              options={adjustmentDirectionOptions}
            />
          ) : null}
          <FormField
            label={isTransfer ? "출발 보관위치" : "보관위치"}
            required
            value={form.storageLocation}
            onChange={(value) => updateField("storageLocation", value)}
            placeholder="예: 자재창고 A-1"
          />
          {isTransfer ? (
            <>
              <FormField
                label="도착 현장"
                required
                type="select"
                value={form.targetSiteId}
                onChange={(value) => updateField("targetSiteId", value)}
                options={siteOptions}
              />
              <FormField
                label="도착 보관위치"
                required
                value={form.targetStorageLocation}
                onChange={(value) => updateField("targetStorageLocation", value)}
                placeholder="예: 야적장 B-2"
              />
            </>
          ) : null}
          {isAdjustment ? (
            <FormField
              label="조정 사유"
              required
              value={form.adjustmentReason}
              onChange={(value) => updateField("adjustmentReason", value)}
              placeholder="예: 월말 실사 차이 보정"
            />
          ) : null}
          <DatePicker label="거래일" required value={form.transactionDate} onChange={(value) => updateField("transactionDate", value)} />
          <FormField
            label="수량"
            required
            type="text"
            inputMode="numeric"
            value={form.quantity}
            onChange={(value) => updateField("quantity", value)}
            placeholder="0"
          />
          <FormField
            label="참조유형"
            value={form.referenceType}
            onChange={(value) => updateField("referenceType", value)}
            placeholder="예: manual-adjustment"
          />
          <FormField
            label="참조번호"
            value={form.referenceNo}
            onChange={(value) => updateField("referenceNo", value)}
            placeholder="예: INV-ADJ-001"
          />
          <FormField
            label="참조명"
            value={form.referenceName}
            onChange={(value) => updateField("referenceName", value)}
            placeholder="예: 월말 실사 조정"
          />
          <FormField
            label="Lot No."
            value={form.lotNo}
            onChange={(value) => updateField("lotNo", value)}
            placeholder="예: LOT-20260316-01"
          />
          <FormField
            label="Serial No."
            value={form.serialNo}
            onChange={(value) => updateField("serialNo", value)}
            placeholder="예: SN-0001234"
          />
          <DatePicker label="유효기간" value={form.expiryDate} onChange={(value) => updateField("expiryDate", value)} />
          <FormField
            label="품질상태"
            type="select"
            value={form.qualityStatus}
            onChange={(value) => updateField("qualityStatus", value)}
            options={qualityStatusOptions}
          />
        </div>
        {(form.transactionType === "receipt" ||
          form.transactionType === "issue" ||
          form.transactionType === "transfer" ||
          form.transactionType === "return" ||
          form.transactionType === "adjustment") ? (
          <div
            className={`rounded-2xl border px-4 py-4 text-sm ${
              exceedsAvailableQuantity
                ? "border-[rgba(201,55,44,0.18)] bg-[rgba(252,235,235,0.72)] text-[color:var(--danger)]"
                : "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]"
            }`}
          >
            {!canEvaluateAvailability ? (
              "현재고를 확인하려면 현장, 자재, 보관위치를 먼저 선택해 주세요."
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase">{stockSummaryTitle}</div>
                <div>
                  현재고: {formatIntegerInput(String(availableQuantity))} {availableUom}
                </div>
                <div>
                  입력 수량: {formatIntegerInput(String(requestedQuantity || 0))} {availableUom}
                </div>
                <div className="font-mono text-base font-semibold">
                  처리 후 재고:{" "}
                  {formatIntegerInput(String(projectedQuantity))}{" "}
                  {availableUom}
                </div>
                {exceedsAvailableQuantity ? (
                  <div>
                    현재고를 {formatIntegerInput(String(requestedQuantity - availableQuantity))}{" "}
                    {availableUom} 초과했습니다.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm text-[color:var(--text-muted)]">
          {form.transactionType === "issue"
            ? "출고는 승인 전까지 현재고에 반영되지 않습니다. 승인 시 선택한 위치의 현재 재고를 다시 검증합니다."
            : form.transactionType === "transfer"
              ? "재고 이동은 같은 프로젝트 안에서만 가능하며 승인 후 출발 위치 출고와 도착 위치 입고가 동시에 생성됩니다."
            : form.transactionType === "adjustment"
              ? "조정은 현재고에 즉시 반영되지 않고 승인 대기 상태로 저장됩니다. 감액 조정은 승인 시점에 현재 재고를 다시 검증합니다."
            : "재고 거래는 append-only 이력으로 남고, 기존 거래를 수정/삭제하지 않습니다."}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/supply-chain/inventory"
            className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={
              saving ||
              projectsLoading ||
              sitesLoading ||
              materialsLoading ||
              exceedsAvailableQuantity
            }
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "재고 거래 저장"}
          </button>
        </div>
      </Panel>
    </>
  );
}
