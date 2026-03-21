import { toTrimmedString } from "@/lib/domain-write";

export function buildPartySnapshot(party: Record<string, unknown>) {
  return {
    partyId: String(party._id),
    code: toTrimmedString(party.code),
    name: toTrimmedString(party.name),
    partyRoles: Array.isArray(party.partyRoles)
      ? party.partyRoles
          .map((value) => toTrimmedString(value))
          .filter(Boolean)
      : [],
    taxId: toTrimmedString(party.taxId),
  };
}
