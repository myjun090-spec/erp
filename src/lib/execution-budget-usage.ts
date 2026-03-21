import { ObjectId, type Db } from "mongodb";
import { toNumberValue } from "@/lib/domain-write";
import { normalizeJournalEntryOriginType } from "@/lib/journal-entry-origin";

const commitmentStatuses = new Set(["approved", "partial-received", "completed"]);
const apActualStatuses = new Set(["approved", "partial-paid", "paid", "overdue"]);
const journalActualStatuses = new Set(["posted"]);

function normalizeBudgetId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBudgetIdFromDocument(doc: Record<string, unknown>) {
  const snapshot =
    doc.budgetSnapshot && typeof doc.budgetSnapshot === "object"
      ? (doc.budgetSnapshot as Record<string, unknown>)
      : null;
  return normalizeBudgetId(snapshot?.budgetId);
}

function getJournalActualAmount(doc: Record<string, unknown>) {
  const totalDebit = toNumberValue(doc.totalDebit);
  const totalCredit = toNumberValue(doc.totalCredit);
  return Math.max(totalDebit, totalCredit);
}

export async function recalculateExecutionBudgetUsage(db: Db, budgetId: string) {
  if (!budgetId || !ObjectId.isValid(budgetId)) {
    return;
  }

  const [purchaseOrders, apInvoices, journalEntries] = await Promise.all([
    db
      .collection("purchase_orders")
      .find({ "budgetSnapshot.budgetId": budgetId })
      .project({ totalAmount: 1, status: 1 })
      .toArray(),
    db
      .collection("ap_invoices")
      .find({ "budgetSnapshot.budgetId": budgetId })
      .project({ totalAmount: 1, status: 1 })
      .toArray(),
    db
      .collection("journal_entries")
      .find({ "budgetSnapshot.budgetId": budgetId })
      .project({ totalDebit: 1, totalCredit: 1, status: 1, originType: 1 })
      .toArray(),
  ]);

  const committedAmount = purchaseOrders.reduce((sum, doc) => {
    return commitmentStatuses.has(String(doc.status || ""))
      ? sum + toNumberValue(doc.totalAmount)
      : sum;
  }, 0);

  const apActualAmount = apInvoices.reduce((sum, doc) => {
    return apActualStatuses.has(String(doc.status || ""))
      ? sum + toNumberValue(doc.totalAmount)
      : sum;
  }, 0);

  const journalActualAmount = journalEntries.reduce((sum, doc) => {
    return journalActualStatuses.has(String(doc.status || "")) &&
      normalizeJournalEntryOriginType(doc.originType) === "manual"
      ? sum + getJournalActualAmount(doc)
      : sum;
  }, 0);

  const actualAmount = apActualAmount + journalActualAmount;

  await db.collection("execution_budgets").updateOne(
    { _id: new ObjectId(budgetId) },
    {
      $set: {
        usageSummary: {
          committedAmount,
          apActualAmount,
          journalActualAmount,
          actualAmount,
          lastCalculatedAt: new Date().toISOString(),
        },
      },
    },
  );
}

export async function recalculateExecutionBudgetUsageForDocs(
  db: Db,
  docs: Array<Record<string, unknown>>,
) {
  const budgetIds = [...new Set(docs.map((doc) => getBudgetIdFromDocument(doc)).filter(Boolean))];
  await Promise.all(budgetIds.map((budgetId) => recalculateExecutionBudgetUsage(db, budgetId)));
}
