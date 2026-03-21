import { buildCreateMetadata, resolveStatus, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import type { ViewerProfile } from "@/lib/navigation";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

function buildAssetProjectSnapshot(project: Record<string, unknown>) {
  return {
    projectId: String(project._id ?? ""),
    code: toTrimmedString(project.code),
    name: toTrimmedString(project.name),
    projectType: toTrimmedString(project.projectType),
  };
}

export const assetClassOptions = [
  { label: "플랜트 장비", value: "plant-equipment" },
  { label: "가설 시설", value: "temporary-facility" },
  { label: "해상 지원설비", value: "marine-support" },
  { label: "시험 장비", value: "testing-equipment" },
  { label: "연구 장비", value: "lab-equipment" },
  { label: "건물", value: "building" },
  { label: "차량", value: "vehicle" },
  { label: "소프트웨어", value: "software" },
  { label: "기타", value: "other" },
] as const;

export const depreciationMethodOptions = [
  { label: "정액법", value: "straight-line" },
  { label: "정률법", value: "declining-balance" },
  { label: "생산량비례법", value: "units-of-production" },
] as const;

export type FixedAssetDepreciationScheduleItem = {
  period: string;
  amount: number;
  accumulated: number;
  bookValue: number;
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMonthStartDate(value: string) {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toPeriodLabel(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function supportsAutomaticDepreciationSchedule(value: unknown) {
  const method = toTrimmedString(value);
  return method === "straight-line" || method === "declining-balance";
}

function normalizeDepreciationSchedule(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as FixedAssetDepreciationScheduleItem[];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const period = toTrimmedString(record.period);
      if (!period) {
        return null;
      }

      return {
        period,
        amount: roundCurrency(Math.max(toNumberValue(record.amount), 0)),
        accumulated: roundCurrency(Math.max(toNumberValue(record.accumulated), 0)),
        bookValue: roundCurrency(Math.max(toNumberValue(record.bookValue), 0)),
      } satisfies FixedAssetDepreciationScheduleItem;
    })
    .filter((item): item is FixedAssetDepreciationScheduleItem => item !== null);
}

function buildStraightLineSchedule(
  acquisitionCost: number,
  usefulLifeMonths: number,
  acquisitionDate: string,
) {
  const startDate = toMonthStartDate(acquisitionDate);
  if (!startDate || acquisitionCost <= 0 || usefulLifeMonths <= 0) {
    return [] as FixedAssetDepreciationScheduleItem[];
  }

  const schedule: FixedAssetDepreciationScheduleItem[] = [];
  let accumulated = 0;
  let remaining = acquisitionCost;
  const monthlyAmount = acquisitionCost / usefulLifeMonths;

  for (let monthIndex = 0; monthIndex < usefulLifeMonths; monthIndex += 1) {
    const amount =
      monthIndex === usefulLifeMonths - 1
        ? roundCurrency(remaining)
        : roundCurrency(monthlyAmount);
    accumulated = roundCurrency(accumulated + amount);
    remaining = roundCurrency(Math.max(acquisitionCost - accumulated, 0));
    schedule.push({
      period: toPeriodLabel(addUtcMonths(startDate, monthIndex)),
      amount,
      accumulated,
      bookValue: remaining,
    });
  }

  return schedule;
}

function buildDecliningBalanceSchedule(
  acquisitionCost: number,
  usefulLifeMonths: number,
  acquisitionDate: string,
) {
  const startDate = toMonthStartDate(acquisitionDate);
  if (!startDate || acquisitionCost <= 0 || usefulLifeMonths <= 0) {
    return [] as FixedAssetDepreciationScheduleItem[];
  }

  const schedule: FixedAssetDepreciationScheduleItem[] = [];
  let accumulated = 0;
  let remaining = acquisitionCost;
  const monthlyRate = 2 / usefulLifeMonths;

  for (let monthIndex = 0; monthIndex < usefulLifeMonths; monthIndex += 1) {
    const remainingPeriods = usefulLifeMonths - monthIndex;
    const currentRemaining = remaining;
    const amount =
      remainingPeriods === 1
        ? roundCurrency(currentRemaining)
        : roundCurrency(
            Math.max(currentRemaining * monthlyRate, currentRemaining / remainingPeriods),
          );
    const boundedAmount = roundCurrency(Math.min(amount, currentRemaining));
    accumulated = roundCurrency(accumulated + boundedAmount);
    remaining = roundCurrency(Math.max(acquisitionCost - accumulated, 0));
    schedule.push({
      period: toPeriodLabel(addUtcMonths(startDate, monthIndex)),
      amount: boundedAmount,
      accumulated,
      bookValue: remaining,
    });
  }

  return schedule;
}

export function buildFixedAssetDepreciationState(input: {
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  ledgerSummary?: unknown;
  depreciationSchedule?: unknown;
  asOfDate?: Date;
}) {
  const acquisitionCost = Math.max(toNumberValue(input.acquisitionCost), 0);
  const usefulLifeMonths = Math.max(toNumberValue(input.usefulLifeMonths), 0);
  const depreciationMethod = toTrimmedString(input.depreciationMethod);
  const existingLedgerSummary = normalizeLedgerSummary(input.ledgerSummary, acquisitionCost);
  const existingSchedule = normalizeDepreciationSchedule(input.depreciationSchedule);

  if (!supportsAutomaticDepreciationSchedule(depreciationMethod)) {
    return {
      depreciationSchedule: existingSchedule,
      ledgerSummary: existingLedgerSummary,
      autoGenerated: false,
    };
  }

  const generatedSchedule =
    depreciationMethod === "declining-balance"
      ? buildDecliningBalanceSchedule(acquisitionCost, usefulLifeMonths, input.acquisitionDate)
      : buildStraightLineSchedule(acquisitionCost, usefulLifeMonths, input.acquisitionDate);

  const asOfPeriod = toPeriodLabel(
    new Date(
      Date.UTC(
        (input.asOfDate ?? new Date()).getUTCFullYear(),
        (input.asOfDate ?? new Date()).getUTCMonth(),
        1,
      ),
    ),
  );
  const currentScheduleItem =
    generatedSchedule.filter((item) => item.period <= asOfPeriod).at(-1) ?? null;
  const ledgerSummary = currentScheduleItem
    ? {
        accumulatedDepreciation: currentScheduleItem.accumulated,
        bookValue: currentScheduleItem.bookValue,
      }
    : {
        accumulatedDepreciation: 0,
        bookValue: acquisitionCost,
      };

  return {
    depreciationSchedule: generatedSchedule,
    ledgerSummary,
    autoGenerated: true,
  };
}

export function getAssetClassLabel(value: unknown) {
  const normalizedValue = toTrimmedString(value);
  return assetClassOptions.find((option) => option.value === normalizedValue)?.label || normalizedValue || "-";
}

export function getDepreciationMethodLabel(value: unknown) {
  const normalizedValue = toTrimmedString(value);
  return (
    depreciationMethodOptions.find((option) => option.value === normalizedValue)?.label ||
    normalizedValue ||
    "-"
  );
}

export function normalizeFixedAssetInput(body: Record<string, unknown>) {
  return {
    assetNo: toTrimmedString(body.assetNo),
    assetClass: toTrimmedString(body.assetClass),
    acquisitionDate: toTrimmedString(body.acquisitionDate),
    acquisitionCost: Math.max(toNumberValue(body.acquisitionCost), 0),
    usefulLifeMonths: Math.max(toNumberValue(body.usefulLifeMonths), 0),
    depreciationMethod: toTrimmedString(body.depreciationMethod) || "straight-line",
    location: toTrimmedString(body.location),
    status: resolveStatus(body.status, "active"),
  };
}

export function validateFixedAssetInput(
  input: ReturnType<typeof normalizeFixedAssetInput>,
  projectId: string,
) {
  if (!input.assetNo) {
    return "자산번호를 입력해 주세요.";
  }
  if (!projectId) {
    return "프로젝트를 선택해 주세요.";
  }
  if (!input.assetClass) {
    return "자산분류를 선택해 주세요.";
  }
  if (!input.acquisitionDate) {
    return "취득일을 입력해 주세요.";
  }
  if (input.acquisitionCost <= 0) {
    return "취득가액은 0보다 커야 합니다.";
  }
  if (input.usefulLifeMonths <= 0) {
    return "내용연수(월)는 1 이상이어야 합니다.";
  }
  if (!input.depreciationMethod) {
    return "감가상각 방법을 선택해 주세요.";
  }
  return null;
}

export function normalizeLedgerSummary(
  value: unknown,
  acquisitionCost: number,
) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const accumulatedDepreciation = Math.max(
    toNumberValue(record?.accumulatedDepreciation),
    0,
  );
  const explicitBookValue = toNumberValue(record?.bookValue, NaN);
  const legacyNetBookValue = toNumberValue(record?.netBookValue, NaN);
  const bookValue = Number.isFinite(explicitBookValue)
    ? explicitBookValue
    : Number.isFinite(legacyNetBookValue)
      ? legacyNetBookValue
      : Math.max(acquisitionCost - accumulatedDepreciation, 0);

  return {
    accumulatedDepreciation,
    bookValue: Math.max(bookValue, 0),
  };
}

export function serializeFixedAsset(doc: Record<string, unknown>) {
  const acquisitionCost = Math.max(toNumberValue(doc.acquisitionCost), 0);
  const depreciationState = buildFixedAssetDepreciationState({
    acquisitionDate: toTrimmedString(doc.acquisitionDate),
    acquisitionCost,
    usefulLifeMonths: Math.max(toNumberValue(doc.usefulLifeMonths), 0),
    depreciationMethod: toTrimmedString(doc.depreciationMethod),
    ledgerSummary: doc.ledgerSummary,
    depreciationSchedule: doc.depreciationSchedule,
  });

  return {
    ...doc,
    _id: String(doc._id ?? ""),
    assetNo: toTrimmedString(doc.assetNo),
    assetClass: toTrimmedString(doc.assetClass),
    acquisitionDate: toTrimmedString(doc.acquisitionDate),
    acquisitionCost,
    usefulLifeMonths: Math.max(toNumberValue(doc.usefulLifeMonths), 0),
    depreciationMethod: toTrimmedString(doc.depreciationMethod),
    location: toTrimmedString(doc.location),
    status: toTrimmedString(doc.status) || "active",
    projectSnapshot:
      doc.projectSnapshot && typeof doc.projectSnapshot === "object" ? doc.projectSnapshot : null,
    ledgerSummary: depreciationState.ledgerSummary,
    depreciationSchedule: depreciationState.depreciationSchedule,
  };
}

export function buildFixedAssetCreateDocument(input: {
  project: Record<string, unknown>;
  body: Record<string, unknown>;
  profile: MutableViewerProfile;
  now: string;
}) {
  const normalized = normalizeFixedAssetInput(input.body);
  const depreciationState = buildFixedAssetDepreciationState({
    acquisitionDate: normalized.acquisitionDate,
    acquisitionCost: normalized.acquisitionCost,
    usefulLifeMonths: normalized.usefulLifeMonths,
    depreciationMethod: normalized.depreciationMethod,
  });
  return {
    assetNo: normalized.assetNo,
    assetClass: normalized.assetClass,
    projectSnapshot: buildAssetProjectSnapshot(input.project),
    location: normalized.location,
    acquisitionDate: normalized.acquisitionDate,
    acquisitionCost: normalized.acquisitionCost,
    usefulLifeMonths: normalized.usefulLifeMonths,
    depreciationMethod: normalized.depreciationMethod,
    ledgerSummary: depreciationState.ledgerSummary,
    depreciationSchedule: depreciationState.depreciationSchedule,
    status: normalized.status,
    ...buildCreateMetadata(input.profile, input.now),
  };
}
