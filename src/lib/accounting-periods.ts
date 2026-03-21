import { toNumberValue, toTrimmedString } from "@/lib/domain-write";

export type AccountingPeriodRecord = {
  periodId: string;
  fiscalYear: number;
  periodNo: number;
  periodLabel: string;
  startDate: string;
  endDate: string;
  closeStatus: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getEndOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function normalizeFiscalYearStartMonth(value: unknown) {
  const month = Math.trunc(toNumberValue(value, 1));
  if (month < 1 || month > 12) {
    return 1;
  }
  return month;
}

export function getFiscalYear(date: Date, fiscalYearStartMonth: number) {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= fiscalYearStartMonth ? year : year - 1;
}

export function getPeriodNo(date: Date, fiscalYearStartMonth: number) {
  const month = date.getUTCMonth() + 1;
  return ((month - fiscalYearStartMonth + 12) % 12) + 1;
}

export function buildMonthlyAccountingPeriod(
  referenceDate: Date,
  fiscalYearStartMonth: number,
  closeStatus: string,
): AccountingPeriodRecord {
  const monthStartDate = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
  );
  const monthEndDate = getEndOfMonth(monthStartDate);
  const periodLabel = toIsoDate(monthStartDate).slice(0, 7);

  return {
    periodId: periodLabel,
    fiscalYear: getFiscalYear(monthStartDate, fiscalYearStartMonth),
    periodNo: getPeriodNo(monthStartDate, fiscalYearStartMonth),
    periodLabel,
    startDate: toIsoDate(monthStartDate),
    endDate: toIsoDate(monthEndDate),
    closeStatus,
  };
}

export function buildNextAccountingPeriod(
  latestPeriodEndDate: string | null | undefined,
  fiscalYearStartMonth: number,
) {
  const nextStartDate = latestPeriodEndDate
    ? addUtcDays(toUtcDate(latestPeriodEndDate), 1)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  return buildMonthlyAccountingPeriod(nextStartDate, fiscalYearStartMonth, "plan");
}

export function normalizeAccountingPeriods(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AccountingPeriodRecord[];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const periodId = toTrimmedString(record.periodId);
      const startDate = toTrimmedString(record.startDate);
      const endDate = toTrimmedString(record.endDate);
      if (!periodId || !startDate || !endDate) {
        return null;
      }

      return {
        periodId,
        fiscalYear: Math.trunc(toNumberValue(record.fiscalYear)),
        periodNo: Math.trunc(toNumberValue(record.periodNo)),
        periodLabel: toTrimmedString(record.periodLabel) || periodId,
        startDate,
        endDate,
        closeStatus: toTrimmedString(record.closeStatus) || "plan",
      } satisfies AccountingPeriodRecord;
    })
    .filter((item): item is AccountingPeriodRecord => item !== null);
}

export function findAccountingPeriodForDate(periods: unknown, journalDate: string) {
  const normalizedJournalDate = toTrimmedString(journalDate);
  if (!normalizedJournalDate) {
    return null;
  }

  return (
    normalizeAccountingPeriods(periods).find(
      (period) =>
        period.startDate <= normalizedJournalDate && normalizedJournalDate <= period.endDate,
    ) ?? null
  );
}
