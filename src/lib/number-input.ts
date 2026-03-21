export function formatIntegerInput(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const digits =
    typeof value === "number"
      ? String(Math.trunc(value))
      : String(value).replace(/[^\d]/g, "");

  if (!digits) {
    return "";
  }

  return Number.parseInt(digits, 10).toLocaleString("ko-KR");
}

export function parseFormattedInteger(value: string) {
  const digits = value.replace(/[^\d]/g, "");

  if (!digits) {
    return 0;
  }

  return Number.parseInt(digits, 10);
}

export function formatIntegerDisplay(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Math.trunc(value).toLocaleString("ko-KR")
      : "";
  }

  const digits = value.replace(/[^\d-]/g, "");

  if (!digits) {
    return value;
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed.toLocaleString("ko-KR") : value;
}
