import { toTrimmedString } from "@/lib/domain-write";

export type JournalEntryOriginType =
  | "manual"
  | "ap"
  | "ar"
  | "asset"
  | "closing"
  | "reclass";

export function normalizeJournalEntryOriginType(value: unknown): JournalEntryOriginType {
  const normalizedValue = toTrimmedString(value).toLowerCase();

  switch (normalizedValue) {
    case "ap":
    case "ar":
    case "asset":
    case "closing":
    case "reclass":
      return normalizedValue;
    case "manual":
    default:
      return "manual";
  }
}

export function getJournalEntryOriginLabel(value: unknown) {
  const originType = normalizeJournalEntryOriginType(value);

  switch (originType) {
    case "ap":
      return "AP 연계";
    case "ar":
      return "AR 연계";
    case "asset":
      return "자산 연계";
    case "closing":
      return "결산";
    case "reclass":
      return "재분류";
    case "manual":
    default:
      return "수기 전표";
  }
}
