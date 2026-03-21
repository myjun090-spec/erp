function extractRestDigits(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("010") ? digits.slice(3) : digits;
  return normalized.slice(0, 8);
}

export function formatMobilePhoneInput(value: string | null | undefined) {
  const rest = extractRestDigits(value);

  if (!rest) {
    return "010";
  }

  if (rest.length <= 4) {
    return `010-${rest}`;
  }

  return `010-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}

export function normalizeMobilePhoneForSave(value: string | null | undefined) {
  const rest = extractRestDigits(value);

  if (!rest) {
    return "";
  }

  if (rest.length <= 4) {
    return `010-${rest}`;
  }

  return `010-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}
