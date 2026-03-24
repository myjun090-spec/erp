/* stub – 제조 ERP 계약청구 기능 제거됨. 재무 API 컴파일용 no-op */

export async function buildContractBillingSummary(_db: unknown, _contract: unknown, _opts?: unknown) {
  return { remainingBillableAmount: Infinity, contractAmount: 0, billedAmount: 0, invoiceCount: 0 };
}

export function buildContractSnapshot(contract: Record<string, unknown>) {
  return { contractId: String(contract._id ?? ""), contractNo: String(contract.contractNo ?? ""), title: String(contract.title ?? "") };
}
