export function normalizeEmailAddress(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidEmailAddress(value: string | null | undefined) {
  const normalized = normalizeEmailAddress(value);
  if (!normalized) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
