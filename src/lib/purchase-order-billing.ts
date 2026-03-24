/* stub – 제조 ERP 발주청구 기능 제거됨. 재무 API 컴파일용 no-op */

export async function buildPurchaseOrderBillingSummary(_db: unknown, _poId: unknown, _opts?: unknown) {
  return { remainingBillableAmount: Infinity, totalBilledAmount: 0, totalAmount: 0 };
}
