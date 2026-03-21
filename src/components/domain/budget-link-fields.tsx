"use client";

import { useEffect, useMemo, useState } from "react";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { FormField } from "@/components/ui/form-field";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";

type WbsItem = {
  _id: string;
  code: string;
  name: string;
};

type BudgetItem = {
  _id: string;
  budgetCode: string;
  version: string;
  totalAmount: number;
  remainingAmount?: number;
  usageSummary?: {
    committedAmount: number;
    actualAmount: number;
  };
  wbsSnapshot: {
    wbsId: string;
    code: string;
    name: string;
  } | null;
};

type Props = {
  projectId: string;
  wbsId: string;
  budgetId: string;
  onProjectChange: (value: string) => void;
  onWbsChange: (value: string) => void;
  onBudgetChange: (value: string) => void;
  onBudgetResolved?: (budget: BudgetItem | null) => void;
};

export function BudgetLinkFields({
  projectId,
  wbsId,
  budgetId,
  onProjectChange,
  onWbsChange,
  onBudgetChange,
  onBudgetResolved,
}: Props) {
  const { currentProjectId, projects, projectsLoading } = useProjectSelection();
  const [wbsItems, setWbsItems] = useState<WbsItem[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    if (!projectId && currentProjectId) {
      onProjectChange(currentProjectId);
    }
  }, [currentProjectId, onProjectChange, projectId]);

  useEffect(() => {
    if (!projectId) {
      setWbsItems([]);
      setBudgetItems([]);
      if (wbsId) {
        onWbsChange("");
      }
      if (budgetId) {
        onBudgetChange("");
      }
      return;
    }

    const controller = new AbortController();

    async function loadProjectBudgetLinks() {
      try {
        const [wbsResponse, budgetResponse] = await Promise.all([
          fetch(appendProjectIdToPath("/api/projects/wbs", projectId), {
            signal: controller.signal,
          }),
          fetch(appendProjectIdToPath("/api/execution-budgets", projectId), {
            signal: controller.signal,
          }),
        ]);

        const [wbsJson, budgetJson] = await Promise.all([
          wbsResponse.json(),
          budgetResponse.json(),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setWbsItems(wbsJson.ok ? wbsJson.data?.items ?? [] : []);
        setBudgetItems(budgetJson.ok ? budgetJson.data?.items ?? [] : []);
      } catch {
        if (!controller.signal.aborted) {
          setWbsItems([]);
          setBudgetItems([]);
        }
      }
    }

    void loadProjectBudgetLinks();

    return () => controller.abort();
  }, [budgetId, onBudgetChange, onWbsChange, projectId, wbsId]);

  useEffect(() => {
    if (!wbsId) {
      if (budgetId) {
        onBudgetChange("");
      }
      return;
    }

    if (!wbsItems.some((item) => item._id === wbsId)) {
      onWbsChange("");
      if (budgetId) {
        onBudgetChange("");
      }
    }
  }, [budgetId, onBudgetChange, onWbsChange, wbsId, wbsItems]);

  const budgetByWbsId = useMemo(() => {
    const map = new Map<string, BudgetItem>();
    for (const item of budgetItems) {
      const linkedWbsId = item.wbsSnapshot?.wbsId ?? "";
      if (linkedWbsId) {
        map.set(linkedWbsId, item);
      }
    }
    return map;
  }, [budgetItems]);

  const resolvedBudget = wbsId ? budgetByWbsId.get(wbsId) ?? null : null;
  const resolvedBudgetId = resolvedBudget?._id ?? "";

  useEffect(() => {
    onBudgetResolved?.(resolvedBudget);
  }, [onBudgetResolved, resolvedBudget]);

  useEffect(() => {
    if (resolvedBudgetId !== budgetId) {
      onBudgetChange(resolvedBudgetId);
    }
  }, [budgetId, onBudgetChange, resolvedBudgetId]);

  const budgetLabel = !projectId
    ? "프로젝트 선택 시 자동 연결"
    : !wbsId
      ? "WBS 선택 시 자동 연결"
      : resolvedBudget
        ? `${resolvedBudget.budgetCode} · ${resolvedBudget.version}`
        : "연결된 실행예산 없음";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <FormField
        label="프로젝트"
        required
        type="select"
        value={projectId}
        onChange={onProjectChange}
        options={projects.map((project) => ({
          label: `${project.code} · ${project.name}`,
          value: project._id,
        }))}
      />
      <FormField
        label="WBS"
        required
        type="select"
        value={wbsId}
        onChange={onWbsChange}
        options={wbsItems.map((item) => ({
          label: `${item.code} · ${item.name}`,
          value: item._id,
        }))}
      />
      <FormField label="실행예산 버전" required type="readonly" value={budgetLabel} />
      {resolvedBudget ? (
        <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                총 예산액
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                {formatIntegerDisplay(resolvedBudget.totalAmount)}원
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                발주 약정
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                {formatIntegerDisplay(resolvedBudget.usageSummary?.committedAmount ?? 0)}원
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                실집행
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                {formatIntegerDisplay(resolvedBudget.usageSummary?.actualAmount ?? 0)}원
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                남은 예산
              </div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                {formatIntegerDisplay(Math.max(resolvedBudget.remainingAmount ?? 0, 0))}원
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {projectsLoading ? (
        <p className="md:col-span-2 lg:col-span-3 text-xs text-[color:var(--text-muted)]">
          프로젝트 옵션을 불러오는 중입니다.
        </p>
      ) : null}
      {projectId && wbsId && !resolvedBudget ? (
        <p className="md:col-span-2 lg:col-span-3 text-xs font-medium text-[color:var(--danger)]">
          선택한 WBS에 연결된 실행예산이 없습니다. 먼저 실행예산을 등록해 주세요.
        </p>
      ) : null}
    </div>
  );
}
