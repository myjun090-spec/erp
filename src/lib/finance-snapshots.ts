import { toTrimmedString } from "@/lib/domain-write";

export function buildAccountingUnitSnapshot(unit: Record<string, unknown>) {
  return {
    accountingUnitId: String(unit._id),
    code: toTrimmedString(unit.code),
    name: toTrimmedString(unit.name),
    currency: toTrimmedString(unit.currency),
  };
}

export function buildAccountSnapshot(account: Record<string, unknown>) {
  return {
    accountCode: toTrimmedString(account.accountCode),
    accountName: toTrimmedString(account.accountName),
    accountType: toTrimmedString(account.accountType),
  };
}
