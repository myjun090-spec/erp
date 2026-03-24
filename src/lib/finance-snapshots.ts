/* stub – 제조 ERP 재무 스냅샷 빌더 제거됨. 재무 API 컴파일용 */

export function buildAccountSnapshot(account: Record<string, unknown>): Record<string, unknown> {
  return { accountId: String(account._id ?? ""), code: String(account.code ?? ""), name: String(account.name ?? "") };
}

export function buildAccountingUnitSnapshot(unit: Record<string, unknown>): Record<string, unknown> {
  return { unitId: String(unit._id ?? ""), code: String(unit.code ?? ""), name: String(unit.name ?? "") };
}
