import { toTrimmedString } from "@/lib/domain-write";

export function normalizeJournalEntryStatus(value: unknown) {
  return toTrimmedString(value).toLowerCase();
}

export function canEditJournalEntry(status: unknown) {
  return normalizeJournalEntryStatus(status) === "draft";
}

export function canSubmitJournalEntry(status: unknown) {
  return normalizeJournalEntryStatus(status) === "draft";
}

export function canCancelJournalEntrySubmit(status: unknown) {
  return normalizeJournalEntryStatus(status) === "submitted";
}

export function canPostJournalEntry(status: unknown) {
  return normalizeJournalEntryStatus(status) === "submitted";
}

export function canReverseJournalEntry(status: unknown) {
  return normalizeJournalEntryStatus(status) === "posted";
}

export function getJournalEntryStatusTone(status: unknown) {
  switch (normalizeJournalEntryStatus(status)) {
    case "draft":
      return "warning" as const;
    case "submitted":
      return "info" as const;
    case "posted":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    case "reversed":
    default:
      return "default" as const;
  }
}
