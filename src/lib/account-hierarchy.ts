export type AccountListOption = {
  _id: string;
  accountCode: string;
  accountName: string;
  accountType?: string;
  parentAccountCode?: string | null;
  postingAllowed?: boolean;
  status?: string;
};

export type ParentAccountOption = {
  value: string;
  accountCode: string;
  label: string;
  source: "account" | "group";
};

export function sanitizeAccountCodeInput(value: string, maxLength = 6) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function getAccountLevelFromParent(parentAccountCode?: string | null) {
  return parentAccountCode ? "child" : "root";
}

function compareAccountCodes(left: string, right: string) {
  const leftNumeric = Number(left);
  const rightNumeric = Number(right);

  if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric)) {
    return leftNumeric - rightNumeric;
  }

  return left.localeCompare(right);
}

function trimTrailingZeros(code: string) {
  const trimmed = code.replace(/0+$/g, "");
  return trimmed || code;
}

export function buildParentAccountOptions(accounts: AccountListOption[]): ParentAccountOption[] {
  const visibleAccounts = accounts.filter((account) => account.status === "active");
  const actualCodes = new Set(visibleAccounts.map((account) => account.accountCode));
  const syntheticGroupCodes = new Set<string>();

  for (const account of visibleAccounts) {
    if (account.parentAccountCode && !actualCodes.has(account.parentAccountCode)) {
      syntheticGroupCodes.add(account.parentAccountCode);
    }
  }

  const options: ParentAccountOption[] = visibleAccounts.map((account) => ({
    value: account._id,
    accountCode: account.accountCode,
    label: `${account.accountCode} · ${account.accountName}`,
    source: "account",
  }));

  for (const accountCode of syntheticGroupCodes) {
    options.push({
      value: `group:${accountCode}`,
      accountCode,
      label: `${accountCode} · 미등록 상위계정`,
      source: "group",
    });
  }

  return options.sort((left, right) => compareAccountCodes(left.accountCode, right.accountCode));
}

export function suggestChildAccountCode(parentAccountCode: string, existingCodes: string[]) {
  const sanitizedParentCode = sanitizeAccountCodeInput(parentAccountCode);
  if (!sanitizedParentCode) {
    return "";
  }

  const numericParentCode = Number(sanitizedParentCode);
  const trailingZeros = sanitizedParentCode.match(/0+$/)?.[0].length ?? 0;

  if (!Number.isFinite(numericParentCode) || trailingZeros === 0) {
    return "";
  }

  const step = 10 ** Math.max(trailingZeros - 1, 0);
  const parentRange = 10 ** trailingZeros;
  const rangeEnd = numericParentCode + parentRange - step;
  const normalizedExistingCodes = new Set(
    existingCodes.map((code) => sanitizeAccountCodeInput(code, sanitizedParentCode.length)),
  );

  for (let candidate = numericParentCode + step; candidate <= rangeEnd; candidate += step) {
    const suggested = String(candidate).padStart(sanitizedParentCode.length, "0");
    if (!normalizedExistingCodes.has(suggested)) {
      return suggested;
    }
  }

  const hierarchyPrefix = trimTrailingZeros(sanitizedParentCode);
  const siblingCount = existingCodes.filter((code) => code.startsWith(hierarchyPrefix)).length;
  return `${hierarchyPrefix}${String(siblingCount + 1).padStart(2, "0")}`.slice(
    0,
    sanitizedParentCode.length,
  );
}

export function accountCodeMatchesParent(accountCode: string, parentAccountCode: string) {
  const sanitizedAccountCode = sanitizeAccountCodeInput(accountCode);
  const sanitizedParentCode = sanitizeAccountCodeInput(parentAccountCode);

  if (!sanitizedAccountCode || !sanitizedParentCode) {
    return true;
  }

  const hierarchyPrefix = trimTrailingZeros(sanitizedParentCode);
  return sanitizedAccountCode.startsWith(hierarchyPrefix);
}
