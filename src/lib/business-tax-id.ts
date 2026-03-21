function extractBusinessTaxIdDigits(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 10) : "";
}

export function formatBusinessTaxIdInput(value: string | null | undefined) {
  const digits = extractBusinessTaxIdDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function normalizeBusinessTaxIdForSave(value: string | null | undefined) {
  const digits = extractBusinessTaxIdDigits(value);
  return digits ? formatBusinessTaxIdInput(digits) : "";
}
