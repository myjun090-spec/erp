import { ObjectId, type ClientSession, type Db } from "mongodb";
import { getEffectiveContractAmount } from "@/lib/contract-amendments";
import { toNumberValue, toTrimmedString } from "@/lib/domain-write";

const billedArStatuses = new Set(["issued", "partial-received", "received", "overdue"]);

export function buildContractSnapshot(contract: Record<string, unknown>) {
  const contractAmount = getEffectiveContractAmount(contract.contractAmount, contract.amendments);

  return {
    contractId: String(contract._id),
    contractNo: toTrimmedString(contract.contractNo),
    title: toTrimmedString(contract.title),
    contractType: toTrimmedString(contract.contractType),
    contractAmount,
    currency: toTrimmedString(contract.currency) || "KRW",
  };
}

export function canCountArInvoiceForContractBilling(status: unknown) {
  return billedArStatuses.has(toTrimmedString(status).toLowerCase());
}

export async function buildContractBillingSummary(
  db: Db,
  contract: Record<string, unknown>,
  options?: { session?: ClientSession },
) {
  const contractId = String(contract._id ?? "");
  const contractAmount = getEffectiveContractAmount(contract.contractAmount, contract.amendments);

  if (!contractId || !ObjectId.isValid(contractId)) {
    return {
      contractAmount,
      billedAmount: 0,
      remainingBillableAmount: contractAmount,
      invoiceCount: 0,
    };
  }

  const invoices = await db
    .collection("ar_invoices")
    .find(
      {
        "contractSnapshot.contractId": contractId,
        status: { $in: Array.from(billedArStatuses) },
      },
      {
        session: options?.session,
        projection: { totalAmount: 1 },
      },
    )
    .toArray();

  const billedAmount = invoices.reduce(
    (sum, invoice) => sum + Math.max(toNumberValue(invoice.totalAmount), 0),
    0,
  );

  return {
    contractAmount,
    billedAmount,
    remainingBillableAmount: Math.max(contractAmount - billedAmount, 0),
    invoiceCount: invoices.length,
  };
}
