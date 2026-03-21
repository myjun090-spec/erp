import { buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import { normalizeJournalEntryOriginType } from "@/lib/journal-entry-origin";

type MutableViewerProfile = {
  displayName: string;
  orgUnitName: string;
  email: string;
};

export type ArJournalEntrySnapshot = {
  journalEntryId: string;
  voucherNo: string;
  status: string;
};

type ArInvoiceSnapshotSource = {
  _id?: unknown;
  invoiceNo?: unknown;
  invoiceDate?: unknown;
  totalAmount?: unknown;
  customerSnapshot?: unknown;
  projectSnapshot?: unknown;
  contractSnapshot?: unknown;
};

export function buildArJournalEntrySnapshot(
  journalEntryId: string,
  voucherNo: string,
  status = "draft",
): ArJournalEntrySnapshot {
  return {
    journalEntryId,
    voucherNo,
    status,
  };
}

export function buildArIssueJournalEntryDocument(input: {
  arInvoice: ArInvoiceSnapshotSource;
  voucherNo: string;
  now: string;
  profile: MutableViewerProfile;
}) {
  const invoiceNo = toTrimmedString(input.arInvoice.invoiceNo) || "-";
  const invoiceId = String(input.arInvoice._id ?? "");
  const totalAmount = Number(input.arInvoice.totalAmount || 0);

  return {
    voucherNo: input.voucherNo,
    journalType: "general",
    journalDate: toTrimmedString(input.arInvoice.invoiceDate) || input.now.slice(0, 10),
    description: `AR 발행 전표 · ${invoiceNo}`,
    originType: normalizeJournalEntryOriginType("ar"),
    sourceSnapshot: {
      sourceType: "ar_invoice",
      sourceId: invoiceId,
      refNo: invoiceNo,
      eventType: "issue",
    },
    customerSnapshot:
      input.arInvoice.customerSnapshot && typeof input.arInvoice.customerSnapshot === "object"
        ? input.arInvoice.customerSnapshot
        : null,
    projectSnapshot:
      input.arInvoice.projectSnapshot && typeof input.arInvoice.projectSnapshot === "object"
        ? input.arInvoice.projectSnapshot
        : null,
    contractSnapshot:
      input.arInvoice.contractSnapshot && typeof input.arInvoice.contractSnapshot === "object"
        ? input.arInvoice.contractSnapshot
        : null,
    totalDebit: totalAmount,
    totalCredit: totalAmount,
    status: "draft",
    ...buildCreateMetadata(input.profile, input.now),
  };
}

export function buildArCollectionJournalEntryDocument(input: {
  arInvoice: ArInvoiceSnapshotSource;
  collectionId: string;
  collectionDate: string;
  amount: number;
  voucherNo: string;
  now: string;
  profile: MutableViewerProfile;
}) {
  const invoiceNo = toTrimmedString(input.arInvoice.invoiceNo) || "-";
  const invoiceId = String(input.arInvoice._id ?? "");

  return {
    voucherNo: input.voucherNo,
    journalType: "general",
    journalDate: input.collectionDate || input.now.slice(0, 10),
    description: `AR 수금 전표 · ${invoiceNo}`,
    originType: normalizeJournalEntryOriginType("ar"),
    sourceSnapshot: {
      sourceType: "ar_invoice",
      sourceId: invoiceId,
      refNo: invoiceNo,
      eventType: "collection",
      collectionId: input.collectionId,
    },
    customerSnapshot:
      input.arInvoice.customerSnapshot && typeof input.arInvoice.customerSnapshot === "object"
        ? input.arInvoice.customerSnapshot
        : null,
    projectSnapshot:
      input.arInvoice.projectSnapshot && typeof input.arInvoice.projectSnapshot === "object"
        ? input.arInvoice.projectSnapshot
        : null,
    contractSnapshot:
      input.arInvoice.contractSnapshot && typeof input.arInvoice.contractSnapshot === "object"
        ? input.arInvoice.contractSnapshot
        : null,
    totalDebit: input.amount,
    totalCredit: input.amount,
    status: "draft",
    ...buildCreateMetadata(input.profile, input.now),
  };
}
