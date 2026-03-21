import { toTrimmedString } from "@/lib/domain-write";

export type PartyQualification = {
  type: string;
  certNo: string;
  validFrom: string;
  validTo: string;
  status: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getTodayDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizePartyQualificationRecord(item: unknown) {
  if (typeof item === "string") {
    const type = toTrimmedString(item);

    if (!type) {
      return null;
    }

    return {
      type,
      certNo: "",
      validFrom: "",
      validTo: "",
      status: "valid",
    } satisfies PartyQualification;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const type = toTrimmedString(record.type);

  if (!type) {
    return null;
  }

  return {
    type,
    certNo: toTrimmedString(record.certNo),
    validFrom: toTrimmedString(record.validFrom),
    validTo: toTrimmedString(record.validTo),
    status: toTrimmedString(record.status) || "valid",
  } satisfies PartyQualification;
}

export function normalizePartyQualifications(value: unknown): PartyQualification[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizePartyQualificationRecord(item))
    .filter((item): item is PartyQualification => item !== null);
}

export function serializePartyQualifications(value: unknown, today = getTodayDateString()) {
  return normalizePartyQualifications(value).map((item) => ({
    ...item,
    status:
      item.validTo && item.validTo < today
        ? "expired"
        : item.status,
  }));
}
