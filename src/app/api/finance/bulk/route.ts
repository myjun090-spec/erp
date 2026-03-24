import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { findAccountingPeriodForDate } from "@/lib/accounting-periods";
import {
  buildApPaymentHistoryItem,
  buildApPaymentSummary,
  normalizeApPaymentHistory,
  resolveEffectiveApStatus,
} from "@/lib/ap-payments";
import { canCancelApApproval, canPayAp } from "@/lib/ap-status";
import {
  buildArCollectionHistoryItem,
  buildArCollectionSummary,
  normalizeArCollectionHistory,
  resolveEffectiveArStatus,
} from "@/lib/ar-collections";
import {
  buildArCollectionJournalEntryDocument,
  buildArIssueJournalEntryDocument,
  buildArJournalEntrySnapshot,
} from "@/lib/ar-journal-entries";
import { buildArChangeHistoryEntry, readArChangeHistory } from "@/lib/ar-history";
import { canCancelArIssue, canCollectAr, canIssueAr } from "@/lib/ar-status";
import { buildContractBillingSummary } from "@/lib/contract-billing";
import { buildActorSnapshot, buildCreateMetadata } from "@/lib/domain-write";
import { recalculateExecutionBudgetUsageForDocs } from "@/lib/execution-budget-usage";
import { generateJournalEntryNo } from "@/lib/document-numbers";
import { normalizeJournalEntryOriginType } from "@/lib/journal-entry-origin";
import {
  canCancelJournalEntrySubmit,
  canPostJournalEntry,
  canReverseJournalEntry,
  canSubmitJournalEntry,
} from "@/lib/journal-entry-status";
import { getMongoClient, getMongoDb, getMongoDbName } from "@/lib/mongodb";
import { buildPurchaseOrderBillingSummary } from "@/lib/purchase-order-billing";
import type { BulkActionRequest } from "@/lib/domain-api";
import type { KnownPermissionCode } from "@/lib/permission-catalog";

const retryableTransactionLabels = [
  "TransientTransactionError",
  "UnknownTransactionCommitResult",
] as const;

function hasRetryableTransactionLabel(error: unknown) {
  if (!error || typeof error !== "object" || !("hasErrorLabel" in error)) {
    return false;
  }

  const candidate = error as { hasErrorLabel?: (label: string) => boolean };
  return retryableTransactionLabels.some((label) => candidate.hasErrorLabel?.(label));
}

async function approveApInvoicesWithPurchaseOrderBillingGuard(
  objectIds: ObjectId[],
  actor: { displayName: string; orgUnitName: string; email: string },
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;
    let affectedDocs: Array<Record<string, unknown>> = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const apInvoices = await db
            .collection("ap_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              invoiceNo: 1,
              invoiceDate: 1,
              totalAmount: 1,
              budgetSnapshot: 1,
              facilitySnapshot: 1,
              wbsSnapshot: 1,
              vendorSnapshot: 1,
              sourceSnapshot: 1,
            })
            .toArray();

          const nonApprovableDocs = apInvoices.filter(
            (doc) => String(doc.status || "") !== "pending",
          );
          if (nonApprovableDocs.length > 0) {
            throw new Error("AP 승인은 대기 상태 문서에만 적용할 수 있습니다.");
          }

          const amountByPurchaseOrderId = new Map<string, number>();
          for (const doc of apInvoices) {
            const sourceSnapshot =
              doc.sourceSnapshot && typeof doc.sourceSnapshot === "object"
                ? (doc.sourceSnapshot as Record<string, unknown>)
                : null;
            const sourceType =
              typeof sourceSnapshot?.sourceType === "string"
                ? sourceSnapshot.sourceType.trim()
                : "";
            const sourceId =
              typeof sourceSnapshot?.sourceId === "string"
                ? sourceSnapshot.sourceId.trim()
                : "";

            if (sourceType !== "purchase_order" || !ObjectId.isValid(sourceId)) {
              continue;
            }

            const totalAmount =
              typeof doc.totalAmount === "number"
                ? doc.totalAmount
                : Number(doc.totalAmount || 0);
            amountByPurchaseOrderId.set(
              sourceId,
              (amountByPurchaseOrderId.get(sourceId) ?? 0) + totalAmount,
            );
          }

          for (const [purchaseOrderId, amountToApprove] of amountByPurchaseOrderId.entries()) {
            const purchaseOrder = await db.collection("purchase_orders").findOne(
              { _id: new ObjectId(purchaseOrderId) },
              { session, projection: { _id: 1, lines: 1, poNo: 1 } },
            );

            if (!purchaseOrder) {
              throw new Error("참조 발주를 찾을 수 없습니다.");
            }

            const billingSummary = await buildPurchaseOrderBillingSummary(db, purchaseOrder, {
              session,
            });
            if (amountToApprove > billingSummary.remainingBillableAmount) {
              const poNo =
                typeof purchaseOrder.poNo === "string" ? purchaseOrder.poNo : "발주";
              throw new Error(
                `${poNo}의 남은 청구 가능 금액 ${billingSummary.remainingBillableAmount.toLocaleString()}원을 초과해 승인할 수 없습니다.`,
              );
            }
          }

          const now = new Date().toISOString();
          const baseTimestamp = Date.now();
          const updateResult = await db.collection("ap_invoices").updateMany(
            { _id: { $in: objectIds }, status: "pending" },
            { $set: { status: "approved", updatedAt: now } },
            { session },
          );

          const journalEntrySnapshotByApId = new Map<string, Record<string, unknown>>();
          for (let index = 0; index < apInvoices.length; index += 1) {
            const doc = apInvoices[index];
            const apId = String(doc._id);
            const existingJournalEntry = await db.collection("journal_entries").findOne(
              {
                "sourceSnapshot.sourceType": "ap_invoice",
                "sourceSnapshot.sourceId": apId,
              },
              {
                session,
                projection: { _id: 1, voucherNo: 1, status: 1 },
              },
            );

            if (existingJournalEntry) {
              journalEntrySnapshotByApId.set(apId, {
                journalEntryId: String(existingJournalEntry._id),
                voucherNo: String(existingJournalEntry.voucherNo || "-"),
                status: String(existingJournalEntry.status || "draft"),
              });
              continue;
            }

            const voucherNo = generateJournalEntryNo(new Date(baseTimestamp + index));
            const journalEntryDoc = {
              voucherNo,
              journalType: "general",
              journalDate: String(doc.invoiceDate || now.slice(0, 10)),
              description: `AP 승인 전표 · ${String(doc.invoiceNo || "-")}`,
              originType: normalizeJournalEntryOriginType("ap"),
              sourceSnapshot: {
                sourceType: "ap_invoice",
                sourceId: apId,
                refNo: String(doc.invoiceNo || "-"),
              },
              facilitySnapshot:
                doc.facilitySnapshot && typeof doc.facilitySnapshot === "object"
                  ? doc.facilitySnapshot
                  : null,
              wbsSnapshot:
                doc.wbsSnapshot && typeof doc.wbsSnapshot === "object"
                  ? doc.wbsSnapshot
                  : null,
              budgetSnapshot:
                doc.budgetSnapshot && typeof doc.budgetSnapshot === "object"
                  ? doc.budgetSnapshot
                  : null,
              vendorSnapshot:
                doc.vendorSnapshot && typeof doc.vendorSnapshot === "object"
                  ? doc.vendorSnapshot
                  : null,
              totalDebit:
                typeof doc.totalAmount === "number" ? doc.totalAmount : Number(doc.totalAmount || 0),
              totalCredit:
                typeof doc.totalAmount === "number" ? doc.totalAmount : Number(doc.totalAmount || 0),
              status: "draft",
              ...buildCreateMetadata(actor, now),
            };

            const insertResult = await db.collection("journal_entries").insertOne(journalEntryDoc, {
              session,
            });
            journalEntrySnapshotByApId.set(apId, {
              journalEntryId: insertResult.insertedId.toString(),
              voucherNo,
              status: "draft",
            });
          }

          const bulkUpdates: Array<{
            updateOne: {
              filter: { _id: ObjectId };
              update: { $set: { journalEntrySnapshot: Record<string, unknown> } };
            };
          }> = [];
          for (const doc of apInvoices) {
            const snapshot = journalEntrySnapshotByApId.get(String(doc._id));
            if (!snapshot) {
              continue;
            }

            bulkUpdates.push({
              updateOne: {
                filter: { _id: doc._id as ObjectId },
                update: {
                  $set: {
                    journalEntrySnapshot: snapshot,
                  },
                },
              },
            });
          }

          if (bulkUpdates.length > 0) {
            await db.collection("ap_invoices").bulkWrite(bulkUpdates, { session });
          }

          return {
            affectedCount: updateResult.modifiedCount,
            affectedDocs: apInvoices,
          };
        });

        affectedCount = transactionResult?.affectedCount ?? 0;
        affectedDocs = transactionResult?.affectedDocs ?? [];
        if (affectedDocs.length > 0) {
          await recalculateExecutionBudgetUsageForDocs(db, affectedDocs);
        }
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

async function cancelApprovedApInvoices(
  objectIds: ObjectId[],
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;
    let affectedDocs: Array<Record<string, unknown>> = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const apInvoices = await db
            .collection("ap_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              budgetSnapshot: 1,
              journalEntrySnapshot: 1,
            })
            .toArray();

          const nonCancelableDocs = apInvoices.filter(
            (doc) => !canCancelApApproval(doc.status),
          );
          if (nonCancelableDocs.length > 0) {
            throw new Error("승인 또는 연체 상태 AP 문서에만 승인 취소를 적용할 수 있습니다.");
          }

          const journalEntryIdsToDelete: ObjectId[] = [];
          for (const doc of apInvoices) {
            const journalEntrySnapshot =
              doc.journalEntrySnapshot && typeof doc.journalEntrySnapshot === "object"
                ? (doc.journalEntrySnapshot as Record<string, unknown>)
                : null;
            const journalEntryId = String(journalEntrySnapshot?.journalEntryId ?? "");
            if (!ObjectId.isValid(journalEntryId)) {
              continue;
            }

            const linkedJournalEntry = await db.collection("journal_entries").findOne(
              { _id: new ObjectId(journalEntryId) },
              { session, projection: { _id: 1, status: 1, originType: 1 } },
            );
            if (!linkedJournalEntry) {
              continue;
            }
            if (String(linkedJournalEntry.originType || "") !== "ap") {
              throw new Error("AP 승인으로 생성되지 않은 전표가 연결되어 있어 승인 취소할 수 없습니다.");
            }
            if (String(linkedJournalEntry.status || "") !== "draft") {
              throw new Error("연계 전표가 draft 상태일 때만 AP 승인 취소가 가능합니다.");
            }
            journalEntryIdsToDelete.push(linkedJournalEntry._id as ObjectId);
          }

          const now = new Date().toISOString();
          const updateResult = await db.collection("ap_invoices").updateMany(
            { _id: { $in: objectIds }, status: { $in: ["approved", "overdue"] } },
            {
              $set: {
                status: "pending",
                updatedAt: now,
              },
              $unset: {
                journalEntrySnapshot: "",
              },
            },
            { session },
          );

          if (journalEntryIdsToDelete.length > 0) {
            await db.collection("journal_entries").deleteMany(
              { _id: { $in: journalEntryIdsToDelete } },
              { session },
            );
          }

          return {
            affectedCount: updateResult.modifiedCount,
            affectedDocs: apInvoices,
          };
        });

        affectedCount = transactionResult?.affectedCount ?? 0;
        affectedDocs = transactionResult?.affectedDocs ?? [];
        if (affectedDocs.length > 0) {
          await recalculateExecutionBudgetUsageForDocs(db, affectedDocs);
        }
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

async function settleApInvoices(
  objectIds: ObjectId[],
  actor: { displayName: string; orgUnitName: string; email: string },
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;
    let affectedDocs: Array<Record<string, unknown>> = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const apInvoices = await db
            .collection("ap_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              totalAmount: 1,
              paymentHistory: 1,
              paymentSummary: 1,
              budgetSnapshot: 1,
            })
            .toArray();

          const nonPayableDocs = apInvoices.filter(
            (doc) => !canPayAp(resolveEffectiveApStatus(doc as Record<string, unknown>)),
          );
          if (nonPayableDocs.length > 0) {
            throw new Error("승인 또는 부분지급 상태 AP에만 지급 처리를 적용할 수 있습니다.");
          }

          const now = new Date().toISOString();
          const paymentDate = now.slice(0, 10);
          const actorSnapshot = buildActorSnapshot(actor);
          const bulkUpdates = apInvoices.map((doc) => {
            const paymentHistory = normalizeApPaymentHistory(doc.paymentHistory);
            const paymentSummary = buildApPaymentSummary({
              ...(doc as Record<string, unknown>),
              paymentHistory,
            });
            if (paymentSummary.remainingAmount <= 0) {
              throw new Error("남은 지급 금액이 없는 AP는 지급 처리할 수 없습니다.");
            }

            const nextPaymentHistory = [
              ...paymentHistory,
              buildApPaymentHistoryItem({
                paymentDate,
                amount: paymentSummary.remainingAmount,
                method: "bulk-settlement",
                note: "일괄 지급 처리",
                now,
                profile: actor,
              }),
            ];
            const nextPaymentSummary = buildApPaymentSummary({
              ...(doc as Record<string, unknown>),
              paymentHistory: nextPaymentHistory,
            });

            return {
              updateOne: {
                filter: { _id: doc._id as ObjectId },
                update: {
                  $set: {
                    status: "paid",
                    paymentHistory: nextPaymentHistory,
                    paymentSummary: {
                      ...nextPaymentSummary,
                      paidAt: nextPaymentSummary.lastPaidAt,
                    },
                    updatedAt: now,
                    updatedBy: actorSnapshot,
                  },
                },
              },
            };
          });

          if (bulkUpdates.length > 0) {
            await db.collection("ap_invoices").bulkWrite(bulkUpdates, { session });
          }

          return {
            affectedCount: bulkUpdates.length,
            affectedDocs: apInvoices,
          };
        });

        affectedCount = transactionResult?.affectedCount ?? 0;
        affectedDocs = transactionResult?.affectedDocs ?? [];
        if (affectedDocs.length > 0) {
          await recalculateExecutionBudgetUsageForDocs(db, affectedDocs);
        }
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

async function issueArInvoices(
  objectIds: ObjectId[],
  actor: { displayName: string; orgUnitName: string; email: string },
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const arInvoices = await db
            .collection("ar_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              invoiceNo: 1,
              invoiceDate: 1,
              totalAmount: 1,
              contractSnapshot: 1,
              customerSnapshot: 1,
              facilitySnapshot: 1,
              changeHistory: 1,
              issueJournalEntrySnapshot: 1,
            })
            .toArray();

          const nonIssuableDocs = arInvoices.filter((doc) => !canIssueAr(doc.status));
          if (nonIssuableDocs.length > 0) {
            throw new Error("초안 상태 AR에만 발행을 적용할 수 있습니다.");
          }

          const amountByContractId = new Map<string, number>();
          for (const doc of arInvoices) {
            const contractSnapshot =
              doc.contractSnapshot && typeof doc.contractSnapshot === "object"
                ? (doc.contractSnapshot as Record<string, unknown>)
                : null;
            const contractId =
              typeof contractSnapshot?.contractId === "string"
                ? contractSnapshot.contractId.trim()
                : "";
            if (!contractId || !ObjectId.isValid(contractId)) {
              throw new Error("계약이 연결되지 않은 AR은 발행할 수 없습니다.");
            }
            const totalAmount =
              typeof doc.totalAmount === "number" ? doc.totalAmount : Number(doc.totalAmount || 0);
            amountByContractId.set(
              contractId,
              (amountByContractId.get(contractId) ?? 0) + totalAmount,
            );
          }

          for (const [contractId, amountToIssue] of amountByContractId.entries()) {
            const contract = await db.collection("contracts").findOne(
              { _id: new ObjectId(contractId) },
              { session, projection: { _id: 1, contractNo: 1, contractAmount: 1, amendments: 1 } },
            );
            if (!contract) {
              throw new Error("참조 계약을 찾을 수 없습니다.");
            }

            const billingSummary = await buildContractBillingSummary(db, contract, { session });
            if (amountToIssue > billingSummary.remainingBillableAmount) {
              const contractNo =
                typeof contract.contractNo === "string" ? contract.contractNo : "계약";
              throw new Error(
                `${contractNo}의 남은 청구 가능 금액 ${billingSummary.remainingBillableAmount.toLocaleString()}원을 초과해 발행할 수 없습니다.`,
              );
            }
          }

          const now = new Date().toISOString();
          const baseTimestamp = Date.now();
          const issueJournalEntrySnapshotByArId = new Map<string, Record<string, unknown>>();
          for (let index = 0; index < arInvoices.length; index += 1) {
            const doc = arInvoices[index];
            const arId = String(doc._id);
            const existingJournalEntry = await db.collection("journal_entries").findOne(
              {
                "sourceSnapshot.sourceType": "ar_invoice",
                "sourceSnapshot.sourceId": arId,
                "sourceSnapshot.eventType": "issue",
              },
              {
                session,
                projection: { _id: 1, voucherNo: 1, status: 1 },
              },
            );

            if (existingJournalEntry) {
              issueJournalEntrySnapshotByArId.set(
                arId,
                buildArJournalEntrySnapshot(
                  String(existingJournalEntry._id),
                  String(existingJournalEntry.voucherNo || "-"),
                  String(existingJournalEntry.status || "draft"),
                ),
              );
              continue;
            }

            const voucherNo = generateJournalEntryNo(new Date(baseTimestamp + index));
            const journalEntryDoc = buildArIssueJournalEntryDocument({
              arInvoice: doc,
              voucherNo,
              now,
              profile: actor,
            });

            const insertResult = await db.collection("journal_entries").insertOne(journalEntryDoc, {
              session,
            });
            issueJournalEntrySnapshotByArId.set(
              arId,
              buildArJournalEntrySnapshot(insertResult.insertedId.toString(), voucherNo),
            );
          }

          const bulkUpdates = arInvoices.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id as ObjectId },
              update: {
                $set: {
                  status: "issued",
                  changeHistory: [
                    buildArChangeHistoryEntry({
                      type: "ar.issued",
                      title: "AR 발행",
                      description: "AR이 발행 처리되고 매출전표 초안이 생성되었습니다.",
                      occurredAt: now,
                      profile: actor,
                    }),
                    ...readArChangeHistory(doc.changeHistory, doc as Record<string, unknown>),
                  ],
                  issueJournalEntrySnapshot:
                    issueJournalEntrySnapshotByArId.get(String(doc._id)) ?? null,
                  updatedAt: now,
                },
              },
            },
          }));

          if (bulkUpdates.length > 0) {
            await db.collection("ar_invoices").bulkWrite(bulkUpdates, { session });
          }

          return bulkUpdates.length;
        });

        affectedCount = transactionResult ?? 0;
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

async function cancelIssuedArInvoices(
  objectIds: ObjectId[],
  actor: { displayName: string; orgUnitName: string; email: string },
  reason: string,
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const arInvoices = await db
            .collection("ar_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              totalAmount: 1,
              collectionSummary: 1,
              collectionHistory: 1,
              changeHistory: 1,
              issueJournalEntrySnapshot: 1,
            })
            .toArray();

          const nonCancelableDocs = arInvoices.filter((doc) => {
            const collectionSummary = buildArCollectionSummary(doc as Record<string, unknown>);
            return !canCancelArIssue(
              resolveEffectiveArStatus(doc as Record<string, unknown>),
              collectionSummary.receivedAmount,
            );
          });
          if (nonCancelableDocs.length > 0) {
            throw new Error("수금 이력이 없는 발행/연체 상태 AR에만 발행 취소를 적용할 수 있습니다.");
          }

          const journalEntryIdsToDelete: ObjectId[] = [];
          for (const doc of arInvoices) {
            const issueJournalEntrySnapshot =
              doc.issueJournalEntrySnapshot && typeof doc.issueJournalEntrySnapshot === "object"
                ? (doc.issueJournalEntrySnapshot as Record<string, unknown>)
                : null;
            const journalEntryId = String(issueJournalEntrySnapshot?.journalEntryId ?? "");
            if (!ObjectId.isValid(journalEntryId)) {
              continue;
            }

            const linkedJournalEntry = await db.collection("journal_entries").findOne(
              { _id: new ObjectId(journalEntryId) },
              {
                session,
                projection: { _id: 1, status: 1, originType: 1, sourceSnapshot: 1 },
              },
            );
            if (!linkedJournalEntry) {
              continue;
            }
            const sourceSnapshot =
              linkedJournalEntry.sourceSnapshot &&
              typeof linkedJournalEntry.sourceSnapshot === "object"
                ? (linkedJournalEntry.sourceSnapshot as Record<string, unknown>)
                : null;
            if (
              String(linkedJournalEntry.originType || "") !== "ar" ||
              String(sourceSnapshot?.eventType || "") !== "issue"
            ) {
              throw new Error("AR 발행으로 생성되지 않은 전표가 연결되어 있어 발행 취소할 수 없습니다.");
            }
            if (String(linkedJournalEntry.status || "") !== "draft") {
              throw new Error("연계 전표가 draft 상태일 때만 AR 발행 취소가 가능합니다.");
            }
            journalEntryIdsToDelete.push(linkedJournalEntry._id as ObjectId);
          }

          const now = new Date().toISOString();
          const bulkUpdates = arInvoices.map((doc) => ({
            updateOne: {
              filter: { _id: doc._id as ObjectId, status: { $in: ["issued", "overdue"] } },
              update: {
                $set: {
                  status: "draft",
                  changeHistory: [
                    buildArChangeHistoryEntry({
                      type: "ar.issue.canceled",
                      title: "AR 발행 취소",
                      description: `발행 금액 ₩ ${Number(doc.totalAmount || 0).toLocaleString()}이 취소되었습니다.`,
                      occurredAt: now,
                      profile: actor,
                      reason,
                    }),
                    ...readArChangeHistory(doc.changeHistory, doc as Record<string, unknown>),
                  ],
                  updatedAt: now,
                },
                $unset: { issueJournalEntrySnapshot: "" },
              },
            },
          }));

          if (bulkUpdates.length > 0) {
            await db.collection("ar_invoices").bulkWrite(bulkUpdates, { session });
          }

          if (journalEntryIdsToDelete.length > 0) {
            await db.collection("journal_entries").deleteMany(
              { _id: { $in: journalEntryIdsToDelete } },
              { session },
            );
          }

          return bulkUpdates.length;
        });

        affectedCount = transactionResult ?? 0;
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

async function collectArInvoices(
  objectIds: ObjectId[],
  actor: { displayName: string; orgUnitName: string; email: string },
) {
  const client = await getMongoClient();
  const db = client.db(getMongoDbName());
  const session = client.startSession();

  try {
    let affectedCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const transactionResult = await session.withTransaction(async () => {
          const arInvoices = await db
            .collection("ar_invoices")
            .find({ _id: { $in: objectIds } }, { session })
            .project({
              _id: 1,
              status: 1,
              invoiceNo: 1,
              totalAmount: 1,
              invoiceDate: 1,
              customerSnapshot: 1,
              facilitySnapshot: 1,
              contractSnapshot: 1,
              collectionHistory: 1,
              collectionSummary: 1,
              changeHistory: 1,
            })
            .toArray();

          const nonCollectableDocs = arInvoices.filter((doc) =>
            !canCollectAr(resolveEffectiveArStatus(doc as Record<string, unknown>)),
          );
          if (nonCollectableDocs.length > 0) {
            throw new Error("발행, 부분수금, 연체 상태 AR에만 수금 처리를 적용할 수 있습니다.");
          }

          const now = new Date().toISOString();
          const collectionDate = now.slice(0, 10);
          const actorSnapshot = buildActorSnapshot(actor);
          const baseTimestamp = Date.now();
          const bulkUpdates = [];

          for (let index = 0; index < arInvoices.length; index += 1) {
            const doc = arInvoices[index];
            const collectionHistory = normalizeArCollectionHistory(doc.collectionHistory);
            const collectionSummary = buildArCollectionSummary({
              ...(doc as Record<string, unknown>),
              collectionHistory,
            });
            if (collectionSummary.remainingAmount <= 0) {
              throw new Error("남은 수금 가능 금액이 없는 AR은 수금 처리할 수 없습니다.");
            }

            const nextCollectionItem = buildArCollectionHistoryItem({
              collectionDate,
              amount: collectionSummary.remainingAmount,
              method: "bulk-settlement",
              note: "일괄 수금 처리",
              now,
              profile: actor,
            });
            const voucherNo = generateJournalEntryNo(new Date(baseTimestamp + index));
            const journalEntryDoc = buildArCollectionJournalEntryDocument({
              arInvoice: doc,
              collectionId: nextCollectionItem.collectionId,
              collectionDate,
              amount: collectionSummary.remainingAmount,
              voucherNo,
              now,
              profile: actor,
            });
            const insertResult = await db.collection("journal_entries").insertOne(journalEntryDoc, {
              session,
            });

            nextCollectionItem.journalEntrySnapshot = buildArJournalEntrySnapshot(
              insertResult.insertedId.toString(),
              voucherNo,
            );

            const nextCollectionHistory = [...collectionHistory, nextCollectionItem];
            const nextCollectionSummary = buildArCollectionSummary({
              ...(doc as Record<string, unknown>),
              collectionHistory: nextCollectionHistory,
            });

            bulkUpdates.push({
              updateOne: {
                filter: { _id: doc._id as ObjectId },
                update: {
                  $set: {
                    status: "received",
                    collectionHistory: nextCollectionHistory,
                    changeHistory: [
                      buildArChangeHistoryEntry({
                        type: "ar.collected",
                        title: "AR 전액 수금",
                        description: `잔액 ₩ ${collectionSummary.remainingAmount.toLocaleString()}이 전액 수금 처리되었습니다.`,
                        occurredAt: now,
                        profile: actor,
                      }),
                      ...readArChangeHistory(doc.changeHistory, doc as Record<string, unknown>),
                    ],
                    collectionSummary: {
                      ...nextCollectionSummary,
                      receivedAt: nextCollectionSummary.lastReceivedAt,
                    },
                    updatedAt: now,
                    updatedBy: actorSnapshot,
                  },
                },
              },
            });
          }

          if (bulkUpdates.length > 0) {
            await db.collection("ar_invoices").bulkWrite(bulkUpdates, { session });
          }

          return bulkUpdates.length;
        });

        affectedCount = transactionResult ?? 0;
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

async function postJournalEntriesWithValidation(objectIds: ObjectId[]) {
  const db = await getMongoDb();
  const journalEntries = await db
    .collection("journal_entries")
    .find({ _id: { $in: objectIds } })
    .project({
      _id: 1,
      voucherNo: 1,
      status: 1,
      journalDate: 1,
      accountingUnitSnapshot: 1,
      accountSnapshot: 1,
      budgetSnapshot: 1,
      originType: 1,
    })
    .toArray();

  const nonPostableDocs = journalEntries.filter(
    (doc) => !canPostJournalEntry(doc.status),
  );
  if (nonPostableDocs.length > 0) {
    throw new Error("전표 확정은 제출 상태 전표에만 적용할 수 있습니다.");
  }

  const incompleteDocs = journalEntries.filter((doc) => {
    const accountingUnitSnapshot =
      doc.accountingUnitSnapshot && typeof doc.accountingUnitSnapshot === "object"
        ? (doc.accountingUnitSnapshot as Record<string, unknown>)
        : null;
    const accountSnapshot =
      doc.accountSnapshot && typeof doc.accountSnapshot === "object"
        ? (doc.accountSnapshot as Record<string, unknown>)
        : null;

    return !accountingUnitSnapshot?.name || !accountSnapshot?.accountCode;
  });
  if (incompleteDocs.length > 0) {
    throw new Error("회계단위와 계정과목이 지정된 전표만 확정할 수 있습니다.");
  }

  const accountingUnitIds = [
    ...new Set(
      journalEntries
        .map((doc) => {
          const accountingUnitSnapshot =
            doc.accountingUnitSnapshot && typeof doc.accountingUnitSnapshot === "object"
              ? (doc.accountingUnitSnapshot as Record<string, unknown>)
              : null;
          const accountingUnitId = String(accountingUnitSnapshot?.accountingUnitId ?? "");
          return ObjectId.isValid(accountingUnitId) ? accountingUnitId : "";
        })
        .filter(Boolean),
    ),
  ];
  const accountingUnits = await db
    .collection("accounting_units")
    .find({
      _id: { $in: accountingUnitIds.map((id) => new ObjectId(id)) },
      status: { $ne: "archived" },
    })
    .project({ _id: 1, code: 1, name: 1, periods: 1 })
    .toArray();
  const accountingUnitById = new Map(accountingUnits.map((unit) => [String(unit._id), unit]));

  for (const doc of journalEntries) {
    const accountingUnitSnapshot =
      doc.accountingUnitSnapshot && typeof doc.accountingUnitSnapshot === "object"
        ? (doc.accountingUnitSnapshot as Record<string, unknown>)
        : null;
    const accountingUnitId = String(accountingUnitSnapshot?.accountingUnitId ?? "");
    const journalDate = String(doc.journalDate ?? "");
    const accountingUnit = accountingUnitById.get(accountingUnitId);

    if (!accountingUnit) {
      throw new Error("존재하지 않거나 보관된 회계단위가 연결된 전표는 확정할 수 없습니다.");
    }

    const matchedPeriod = findAccountingPeriodForDate(accountingUnit.periods, journalDate);
    if (!matchedPeriod) {
      throw new Error(
        `${String(doc.voucherNo || "전표")}의 전표일 ${journalDate || "-"}에 해당하는 회계기간이 없습니다.`,
      );
    }

    if (matchedPeriod.closeStatus !== "open") {
      throw new Error(
        `${String(accountingUnit.code || accountingUnit.name || "회계단위")} ${matchedPeriod.periodLabel} 회계기간이 열려 있지 않아 전표를 확정할 수 없습니다.`,
      );
    }
  }

  const now = new Date().toISOString();
  const result = await db.collection("journal_entries").updateMany(
    { _id: { $in: objectIds }, status: "submitted" },
    { $set: { status: "posted", postedAt: now, updatedAt: now } },
  );
  await recalculateExecutionBudgetUsageForDocs(db, journalEntries);
  return result.modifiedCount;
}

async function submitJournalEntries(objectIds: ObjectId[]) {
  const db = await getMongoDb();
  const journalEntries = await db
    .collection("journal_entries")
    .find({ _id: { $in: objectIds } })
    .project({ _id: 1, status: 1 })
    .toArray();

  const nonSubmittableDocs = journalEntries.filter((doc) => !canSubmitJournalEntry(doc.status));
  if (nonSubmittableDocs.length > 0) {
    throw new Error("전표 제출은 초안 상태 전표에만 적용할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const result = await db.collection("journal_entries").updateMany(
    { _id: { $in: objectIds }, status: "draft" },
    { $set: { status: "submitted", updatedAt: now } },
  );
  return result.modifiedCount;
}

async function cancelSubmittedJournalEntries(objectIds: ObjectId[]) {
  const db = await getMongoDb();
  const journalEntries = await db
    .collection("journal_entries")
    .find({ _id: { $in: objectIds } })
    .project({ _id: 1, status: 1 })
    .toArray();

  const nonCancelableDocs = journalEntries.filter(
    (doc) => !canCancelJournalEntrySubmit(doc.status),
  );
  if (nonCancelableDocs.length > 0) {
    throw new Error("제출 취소는 제출 상태 전표에만 적용할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const result = await db.collection("journal_entries").updateMany(
    { _id: { $in: objectIds }, status: "submitted" },
    { $set: { status: "draft", updatedAt: now } },
  );
  return result.modifiedCount;
}

async function reverseJournalEntriesWithValidation(objectIds: ObjectId[]) {
  const db = await getMongoDb();
  const journalEntries = await db
    .collection("journal_entries")
    .find({ _id: { $in: objectIds } })
    .project({
      _id: 1,
      status: 1,
      budgetSnapshot: 1,
      totalAmount: 1,
      totalDebit: 1,
      totalCredit: 1,
      originType: 1,
    })
    .toArray();

  const nonReversibleDocs = journalEntries.filter(
    (doc) => !canReverseJournalEntry(doc.status),
  );
  if (nonReversibleDocs.length > 0) {
    throw new Error("역분개는 확정(posted) 상태 전표에만 적용할 수 있습니다.");
  }

  const now = new Date().toISOString();
  const result = await db.collection("journal_entries").updateMany(
    { _id: { $in: objectIds }, status: "posted" },
    { $set: { status: "reversed", reversedAt: now, updatedAt: now } },
  );
  await recalculateExecutionBudgetUsageForDocs(db, journalEntries);
  return result.modifiedCount;
}

export async function POST(request: Request) {
  try {
    const body: BulkActionRequest = await request.json();
    const { action, targetIds, reason = "" } = body;
    const actionPermissionMap: Partial<Record<string, KnownPermissionCode>> = {
      "submit-journal-entry": "journal-entry.submit",
      "cancel-journal-submit": "journal-entry.submit",
      post: "journal-entry.post",
      reverse: "journal-entry.reverse",
      "approve-ap": "ap.approve",
      "cancel-ap-approval": "ap.cancel-approval",
      pay: "ap.pay",
      issue: "ar.issue",
      "cancel-issue": "ar.cancel-issue",
      collect: "ar.collect",
    };
    const requiredPermission = actionPermissionMap[action];

    if (!requiredPermission) {
      return NextResponse.json(
        { ok: false, message: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    const auth = await requireApiActionPermission(requiredPermission);
    if ("error" in auth) return auth.error;

    const objectIds = targetIds.map((id) => new ObjectId(id));

    switch (action) {
      // Journal entry actions
      case "submit-journal-entry": {
        const affectedCount = await submitJournalEntries(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "cancel-journal-submit": {
        const affectedCount = await cancelSubmittedJournalEntries(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "post": {
        const affectedCount = await postJournalEntriesWithValidation(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "reverse": {
        const affectedCount = await reverseJournalEntriesWithValidation(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      // AP actions
      case "approve-ap": {
        const affectedCount = await approveApInvoicesWithPurchaseOrderBillingGuard(
          objectIds,
          auth.profile,
        );
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "cancel-ap-approval": {
        const affectedCount = await cancelApprovedApInvoices(objectIds);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "pay": {
        const affectedCount = await settleApInvoices(objectIds, auth.profile);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      // AR actions
      case "issue": {
        const affectedCount = await issueArInvoices(objectIds, auth.profile);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "cancel-issue": {
        if (!reason.trim()) {
          return NextResponse.json(
            { ok: false, message: "발행 취소 사유를 입력해 주세요." },
            { status: 400 },
          );
        }
        const affectedCount = await cancelIssuedArInvoices(objectIds, auth.profile, reason);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      case "collect": {
        const affectedCount = await collectArInvoices(objectIds, auth.profile);
        return NextResponse.json({ ok: true, action, affectedCount, targetIds });
      }
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
