function pad(value: number, size = 2) {
  return String(value).padStart(size, "0");
}

function buildTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = pad(date.getMilliseconds(), 3);

  return `${year}${month}${day}-${hours}${minutes}${seconds}${milliseconds}`;
}

export function generateContractNo(date = new Date()) {
  return `CT-${buildTimestamp(date)}`;
}

export function generateOrgUnitCode(date = new Date()) {
  return `ORG-${buildTimestamp(date)}`;
}

export function generateProjectCode(date = new Date()) {
  return `PRJ-${buildTimestamp(date)}`;
}

export function generateSiteCode(date = new Date()) {
  return `SITE-${buildTimestamp(date)}`;
}

export function generateUnitNo(date = new Date()) {
  return `UNIT-${buildTimestamp(date)}`;
}

export function generateSystemCode(date = new Date()) {
  return `SYS-${buildTimestamp(date)}`;
}

export function generateExecutionBudgetCode(date = new Date()) {
  return `EB-${buildTimestamp(date)}`;
}

export function generateVendorCode(date = new Date()) {
  return `VND-${buildTimestamp(date)}`;
}

export function generatePartyCode(date = new Date()) {
  return `PTY-${buildTimestamp(date)}`;
}

export function generateMaterialCode(date = new Date()) {
  return `MAT-${buildTimestamp(date)}`;
}

export function generatePurchaseOrderNo(date = new Date()) {
  return `PO-${buildTimestamp(date)}`;
}

export function generateApInvoiceNo(date = new Date()) {
  return `AP-${buildTimestamp(date)}`;
}

export function generateArInvoiceNo(date = new Date()) {
  return `AR-${buildTimestamp(date)}`;
}

export function generateJournalEntryNo(date = new Date()) {
  return `JE-${buildTimestamp(date)}`;
}

export function generateModuleNo(date = new Date()) {
  return `MOD-${buildTimestamp(date)}`;
}

export function generateManufacturingOrderNo(date = new Date()) {
  return `MO-${buildTimestamp(date)}`;
}

export function generateShipmentNo(date = new Date()) {
  return `SHP-${buildTimestamp(date)}`;
}

export function generatePackageNo(date = new Date()) {
  return `PKG-${buildTimestamp(date)}`;
}

export function generateRegulatoryActionNo(date = new Date()) {
  return `REG-${buildTimestamp(date)}`;
}

export function generateInventoryTransferNo(date = new Date()) {
  return `TRF-${buildTimestamp(date)}`;
}

export function generateInventoryReceiptNo(date = new Date()) {
  return `RCV-${buildTimestamp(date)}`;
}

export function generateIncidentNo(date = new Date()) {
  return `HSE-${buildTimestamp(date)}`;
}

export function generateItpCode(date = new Date()) {
  return `ITP-${buildTimestamp(date)}`;
}

export function generateInspectionNo(date = new Date()) {
  return `INSP-${buildTimestamp(date)}`;
}

export function generateNcrNo(date = new Date()) {
  return `NCR-${buildTimestamp(date)}`;
}
