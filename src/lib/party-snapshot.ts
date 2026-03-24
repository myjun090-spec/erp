/* stub – 제조 ERP 거래처 스냅샷 제거됨. 재무 API 컴파일용 no-op */

export function buildPartySnapshot(party: Record<string, unknown>): Record<string, unknown> {
  return { partyId: String(party._id ?? ""), name: String(party.name ?? ""), code: String(party.code ?? "") };
}
