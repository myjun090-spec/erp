import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { recalculateExecutionBudgetUsageForDocs } from "@/lib/execution-budget-usage";
import {
  calculateExecutionBudgetRemainingAmount,
  normalizeExecutionBudgetUsageSummary,
} from "@/lib/execution-budgets";
import { getMongoClient, getMongoDb, getMongoDbName } from "@/lib/mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";

const commitmentStatuses = new Set(["approved", "partial-received", "completed"]);
const retryableTransactionLabels = [
  "TransientTransactionError",
  "UnknownTransactionCommitResult",
] as const;

function getBudgetId(doc: Record<string, unknown>) {
  const snapshot =
    doc.budgetSnapshot && typeof doc.budgetSnapshot === "object"
      ? (doc.budgetSnapshot as Record<string, unknown>)
      : null;

  return typeof snapshot?.budgetId === "string" ? snapshot.budgetId.trim() : "";
}

function hasRetryableTransactionLabel(error: unknown) {
  if (!error || typeof error !== "object" || !("hasErrorLabel" in error)) {
    return false;
  }

  const candidate = error as { hasErrorLabel?: (label: string) => boolean };
  return retryableTransactionLabels.some((label) => candidate.hasErrorLabel?.(label));
}

async function approvePurchaseOrdersWithBudgetGuard(
  objectIds: ObjectId[],
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const purchaseOrders = await db
            .collection("purchase_orders")
            .find({ _id: { $in: objectIds } }, { session })
            .project({ _id: 1, budgetSnapshot: 1, status: 1, totalAmount: 1 })
            .toArray();

          const docsToApprove = purchaseOrders.filter(
            (doc) => !commitmentStatuses.has(String(doc.status || "")),
          );

          if (docsToApprove.length === 0) {
            return { affectedCount: 0 };
          }

          const budgetAmountById = new Map<string, number>();
          for (const doc of docsToApprove) {
            const budgetId = getBudgetId(doc);
            if (!budgetId) {
              continue;
            }

            const totalAmount =
              typeof doc.totalAmount === "number"
                ? doc.totalAmount
                : Number(doc.totalAmount || 0);

            budgetAmountById.set(
              budgetId,
              (budgetAmountById.get(budgetId) ?? 0) + totalAmount,
            );
          }

          for (const [budgetId, amountToCommit] of budgetAmountById.entries()) {
            if (!ObjectId.isValid(budgetId)) {
              throw new Error("발주에 연결된 실행예산 식별자가 올바르지 않습니다.");
            }

            const budget = await db.collection("execution_budgets").findOne(
              { _id: new ObjectId(budgetId) },
              {
                session,
                projection: { totalAmount: 1, usageSummary: 1, budgetCode: 1, version: 1 },
              },
            );

            if (!budget) {
              throw new Error("발주에 연결된 실행예산을 찾을 수 없습니다.");
            }

            const totalAmount =
              typeof budget.totalAmount === "number"
                ? budget.totalAmount
                : Number(budget.totalAmount || 0);
            const usageSummary = normalizeExecutionBudgetUsageSummary(budget.usageSummary);
            const remainingAmount = Math.max(
              calculateExecutionBudgetRemainingAmount(totalAmount, usageSummary),
              0,
            );

            if (amountToCommit > remainingAmount) {
              const budgetCode =
                typeof budget.budgetCode === "string" ? budget.budgetCode : "실행예산";
              throw new Error(
                `${budgetCode}의 남은 예산 ${remainingAmount.toLocaleString()}원을 초과해 승인할 수 없습니다.`,
              );
            }
          }

          const targetIds = docsToApprove.map((doc) => doc._id);
          const now = new Date().toISOString();
          const updateResult = await db.collection("purchase_orders").updateMany(
            { _id: { $in: targetIds } },
            {
              $set: {
                status: "approved",
                updatedAt: now,
              },
            },
            { session },
          );

          for (const [budgetId, amountToCommit] of budgetAmountById.entries()) {
            await db.collection("execution_budgets").updateOne(
              { _id: new ObjectId(budgetId) },
              {
                $inc: { "usageSummary.committedAmount": amountToCommit },
                $set: { "usageSummary.lastCalculatedAt": now },
              },
              { session },
            );
          }

          return { affectedCount: updateResult.modifiedCount };
        });

        affectedCount = transactionResult?.affectedCount ?? 0;
        return affectedCount;
      } catch (error) {
        if (!hasRetryableTransactionLabel(error) || attempt === 2) {
          throw error;
        }
      }
    }

    return affectedCount;
  } finally {
    await session.endSession();
  }
}

async function cancelPurchaseOrderApprovalWithBudgetRollback(
  objectIds: ObjectId[],
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const purchaseOrders = await db
            .collection("purchase_orders")
            .find({ _id: { $in: objectIds } }, { session })
            .project({ _id: 1, budgetSnapshot: 1, status: 1, totalAmount: 1 })
            .toArray();

          const docsToRollback = purchaseOrders.filter(
            (doc) => String(doc.status || "") === "approved",
          );

          if (docsToRollback.length === 0) {
            return { affectedCount: 0 };
          }

          const nonCancelableDocs = purchaseOrders.filter(
            (doc) => String(doc.status || "") !== "approved",
          );
          if (nonCancelableDocs.length > 0) {
            throw new Error("승인 취소는 승인 상태 발주에만 적용할 수 있습니다.");
          }

          const budgetAmountById = new Map<string, number>();
          for (const doc of docsToRollback) {
            const budgetId = getBudgetId(doc);
            if (!budgetId) {
              continue;
            }

            const totalAmount =
              typeof doc.totalAmount === "number"
                ? doc.totalAmount
                : Number(doc.totalAmount || 0);

            budgetAmountById.set(
              budgetId,
              (budgetAmountById.get(budgetId) ?? 0) + totalAmount,
            );
          }

          const targetIds = docsToRollback.map((doc) => doc._id);
          const now = new Date().toISOString();
          const updateResult = await db.collection("purchase_orders").updateMany(
            { _id: { $in: targetIds }, status: "approved" },
            {
              $set: {
                status: "submitted",
                updatedAt: now,
              },
            },
            { session },
          );

          for (const [budgetId, amountToRollback] of budgetAmountById.entries()) {
            if (!ObjectId.isValid(budgetId)) {
              continue;
            }

            const budgetObjectId = new ObjectId(budgetId);
            const budget = await db.collection("execution_budgets").findOne(
              { _id: budgetObjectId },
              {
                session,
                projection: { usageSummary: 1 },
              },
            );
            const usageSummary = normalizeExecutionBudgetUsageSummary(budget?.usageSummary);
            const nextCommittedAmount = Math.max(
              usageSummary.committedAmount - amountToRollback,
              0,
            );

            await db.collection("execution_budgets").updateOne(
              { _id: budgetObjectId },
              {
                $set: {
                  "usageSummary.committedAmount": nextCommittedAmount,
                  "usageSummary.lastCalculatedAt": now,
                },
              },
              { session },
            );
          }

          return { affectedCount: updateResult.modifiedCount };
        });

        affectedCount = transactionResult?.affectedCount ?? 0;
        return affectedCount;
      } catch (error) {
        if (!hasRetryableTransactionLabel(error) || attempt === 2) {
          throw error;
        }
      }
    }

    return affectedCount;
  } finally {
    await session.endSession();
  }
}

async function submitPurchaseOrders(
  objectIds: ObjectId[],
) {
  const db = await getMongoDb();
  const purchaseOrders = await db
    .collection("purchase_orders")
    .find({ _id: { $in: objectIds } })
    .project({ _id: 1, status: 1 })
    .toArray();

  const nonSubmittableDocs = purchaseOrders.filter(
    (doc) => String(doc.status || "") !== "draft",
  );
  if (nonSubmittableDocs.length > 0) {
    throw new Error("제출은 초안 상태 발주에만 적용할 수 있습니다.");
  }

  const targetIds = purchaseOrders.map((doc) => doc._id);
  if (targetIds.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const result = await db.collection("purchase_orders").updateMany(
    { _id: { $in: targetIds }, status: "draft" },
    {
      $set: {
        status: "submitted",
        updatedAt: now,
      },
    },
  );

  return result.modifiedCount;
}

export async function POST(request: Request) {
  try {
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    const auth = await requireApiActionPermission(
      action === "submit"
        ? "purchase-order.submit"
        : action === "approve"
          ? "purchase-order.approve"
          : action === "reject"
            ? "purchase-order.reject"
            : action === "cancel-approval"
              ? "purchase-order.cancel-approval"
              : "purchase-order.update",
    );
    if ("error" in auth) return auth.error;
    const objectIds = targetIds.map((id) => new ObjectId(id));
    switch (action) {
      case "submit": {
        const affectedCount = await submitPurchaseOrders(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "approve": {
        const affectedCount = await approvePurchaseOrdersWithBudgetGuard(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "cancel-approval": {
        const affectedCount = await cancelPurchaseOrderApprovalWithBudgetRollback(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "reject": {
        const db = await getMongoDb();
        const affectedDocs = await db
          .collection("purchase_orders")
          .find({ _id: { $in: objectIds } })
          .project({ budgetSnapshot: 1, status: 1 })
          .toArray();
        const nonRejectableDocs = affectedDocs.filter(
          (doc) => String(doc.status || "") !== "submitted",
        );
        if (nonRejectableDocs.length > 0) {
          throw new Error("반려는 제출 상태 발주에만 적용할 수 있습니다.");
        }
        const now = new Date().toISOString();
        const result = await db.collection("purchase_orders").updateMany(
          { _id: { $in: objectIds }, status: "submitted" },
          { $set: { status: "rejected", updatedAt: now } },
        );
        await recalculateExecutionBudgetUsageForDocs(db, affectedDocs);
        return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
      }
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
