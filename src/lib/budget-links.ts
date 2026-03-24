/* stub – 제조 ERP 예산연계 기능 제거됨. 재무 API 컴파일용 no-op */

export function validateBudgetLinkInput(_input: unknown): { valid: true } | { valid: false; message: string } {
  return { valid: true };
}

export function normalizeBudgetLinkInput(_input: unknown): unknown[] {
  return [];
}

export async function resolveBudgetLinkDocuments(..._args: unknown[]): Promise<Record<string, any>> {
  return { project: null, wbs: null, budget: null };
}

export function buildBudgetLinkSnapshots(..._args: unknown[]): unknown[] {
  return [];
}
