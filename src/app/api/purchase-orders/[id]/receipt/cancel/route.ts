import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import {
  buildInventoryTransactionDocument,
  buildReferenceSnapshot,
  summarizeInventoryBalance,
} from "@/lib/inventory-transactions";
import { getMongoClient, getMongoDb, getMongoDbName } from "@/lib/mongodb";
import { buildPurchaseOrderBillingSummary } from "@/lib/purchase-order-billing";
import { getProjectAccessScope } from "@/lib/project-access";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("purchase-order.cancel-receipt");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const receiptNo = toTrimmedString(body.receiptNo);
    const cancelReason = toTrimmedString(body.reason);
    if (!receiptNo) {
      return NextResponse.json(
        { ok: false, message: "취소할 입고번호를 선택해 주세요." },
        { status: 400 },
      );
    }
    if (!cancelReason) {
      return NextResponse.json(
        { ok: false, message: "입고 취소 사유를 입력해 주세요." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const existing = await db.collection("purchase_orders").findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      existing.projectSnapshot && typeof existing.projectSnapshot === "object"
        ? String((existing.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !projectAccessScope.allowedProjectIds.includes(projectId)
    ) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    const client = await getMongoClient();
    const transactionalDb = client.db(getMongoDbName());
    const session = client.startSession();

    try {
      let affectedCount = 0;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const transactionResult = await session.withTransaction(async () => {
            const current = await transactionalDb.collection("purchase_orders").findOne(
              { _id: new ObjectId(id) },
              { session },
            );
            if (!current) {
              throw new Error("발주를 찾을 수 없습니다.");
            }

            const receiptHistory = Array.isArray(current.receiptHistory) ? current.receiptHistory : [];
            const targetReceipt = receiptHistory.find((entry) => {
              const record =
                entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
              return (
                toTrimmedString(record.receiptNo) === receiptNo &&
                toTrimmedString(record.status || "completed") === "completed"
              );
            });
            let receiptRecord: Record<string, unknown> | null =
              targetReceipt && typeof targetReceipt === "object"
                ? (targetReceipt as Record<string, unknown>)
                : null;

            if (!receiptRecord && receiptNo.startsWith("LEGACY-")) {
              const legacySeedId = receiptNo.replace("LEGACY-", "");
              if (ObjectId.isValid(legacySeedId)) {
                const seedTransaction = await transactionalDb
                  .collection("inventory_transactions")
                  .findOne({ _id: new ObjectId(legacySeedId) }, { session });
                if (seedTransaction) {
                  const seedSiteSnapshot =
                    seedTransaction.siteSnapshot &&
                    typeof seedTransaction.siteSnapshot === "object"
                      ? (seedTransaction.siteSnapshot as Record<string, unknown>)
                      : {};
                  const legacyDocs = await transactionalDb
                    .collection("inventory_transactions")
                    .find(
                      {
                        transactionType: "receipt",
                        "referenceSnapshot.referenceType": "purchase_order",
                        "referenceSnapshot.referenceId": id,
                        transactionDate: seedTransaction.transactionDate,
                        createdAt: seedTransaction.createdAt,
                        storageLocation: seedTransaction.storageLocation,
                        "siteSnapshot.siteId": String(seedSiteSnapshot.siteId ?? ""),
                      },
                      { session },
                    )
                    .toArray();

                  if (legacyDocs.length > 0) {
                    receiptRecord = {
                      receiptNo,
                      transactionDate: toTrimmedString(seedTransaction.transactionDate),
                      storageLocation: toTrimmedString(seedTransaction.storageLocation),
                      status: "completed",
                      siteSnapshot: {
                        siteId: String(seedSiteSnapshot.siteId ?? ""),
                        code: String(seedSiteSnapshot.code ?? ""),
                        name: String(seedSiteSnapshot.name ?? ""),
                      },
                      lineItems: legacyDocs.map((doc, index) => {
                        const materialSnapshot =
                          doc.materialSnapshot && typeof doc.materialSnapshot === "object"
                            ? (doc.materialSnapshot as Record<string, unknown>)
                            : {};
                        return {
                          lineNo: index + 1,
                          quantity: toNumberValue(doc.quantity),
                          uom: typeof doc.uom === "string" ? doc.uom : "",
                          materialId:
                            typeof materialSnapshot.materialId === "string"
                              ? materialSnapshot.materialId
                              : "",
                          materialDescription:
                            typeof materialSnapshot.description === "string"
                              ? materialSnapshot.description
                              : `라인 ${index + 1}`,
                        };
                      }),
                    };
                  }
                }
              }
            }

            if (!receiptRecord) {
              throw new Error("취소 가능한 입고 이력을 찾을 수 없습니다.");
            }

            const siteSnapshot =
              receiptRecord.siteSnapshot && typeof receiptRecord.siteSnapshot === "object"
                ? (receiptRecord.siteSnapshot as Record<string, unknown>)
                : null;
            const receiptSiteId = typeof siteSnapshot?.siteId === "string" ? siteSnapshot.siteId : "";
            const storageLocation = toTrimmedString(receiptRecord.storageLocation);
            const lineItems = Array.isArray(receiptRecord.lineItems) ? receiptRecord.lineItems : [];
            if (!receiptSiteId || !storageLocation || lineItems.length === 0) {
              throw new Error("입고 이력 정보가 올바르지 않아 취소할 수 없습니다.");
            }

            const currentLines = Array.isArray(current.lines) ? current.lines : [];
            const updatedLines = currentLines.map((line) => {
              const record =
                line && typeof line === "object" ? (line as Record<string, unknown>) : {};
              const lineNo = toNumberValue(record.lineNo);
              const receiptLine = lineItems.find((item) => {
                const lineRecord =
                  item && typeof item === "object" ? (item as Record<string, unknown>) : {};
                return toNumberValue(lineRecord.lineNo) === lineNo;
              });
              if (!receiptLine || typeof receiptLine !== "object") {
                return record;
              }

              const canceledQuantity = toNumberValue(
                (receiptLine as Record<string, unknown>).quantity,
              );
              const currentReceivedQuantity = toNumberValue(record.receivedQuantity);
              if (canceledQuantity > currentReceivedQuantity) {
                throw new Error(`라인 ${lineNo}의 기입고수량보다 큰 취소 수량입니다.`);
              }

              return {
                ...record,
                receivedQuantity: currentReceivedQuantity - canceledQuantity,
              };
            });

            for (const item of lineItems) {
              const lineRecord =
                item && typeof item === "object" ? (item as Record<string, unknown>) : {};
              const materialId = toTrimmedString(lineRecord.materialId);
              const cancelQuantity = toNumberValue(lineRecord.quantity);
              if (!materialId || cancelQuantity <= 0) {
                throw new Error("입고 이력 자재 정보가 올바르지 않습니다.");
              }

              const availableQuantity = await summarizeInventoryBalance(transactionalDb, {
                materialId,
                projectId,
                siteId: receiptSiteId,
                storageLocation,
                lotNo: "",
                serialNo: "",
                expiryDate: "",
                qualityStatus: "available",
              });
              if (cancelQuantity > availableQuantity) {
                throw new Error(
                  `입고 취소 수량이 현재고 ${availableQuantity.toLocaleString()}를 초과해 취소할 수 없습니다.`,
                );
              }
            }

            const billedSummary = await buildPurchaseOrderBillingSummary(transactionalDb, {
              ...current,
              _id: id,
              lines: updatedLines,
            }, { session });
            if (billedSummary.billedAmount > billedSummary.receivedAmount) {
              throw new Error("이미 승인된 AP 금액보다 입고 금액이 작아져 입고를 취소할 수 없습니다.");
            }

            const orderedTotal = updatedLines.reduce(
              (sum, line) => sum + toNumberValue((line as Record<string, unknown>).quantity),
              0,
            );
            const receivedTotal = updatedLines.reduce(
              (sum, line) => sum + toNumberValue((line as Record<string, unknown>).receivedQuantity),
              0,
            );
            const nextStatus =
              receivedTotal <= 0
                ? "approved"
                : receivedTotal >= orderedTotal &&
                    updatedLines.every((line) => {
                      const record = line as Record<string, unknown>;
                      return (
                        toNumberValue(record.receivedQuantity) >= toNumberValue(record.quantity)
                      );
                    })
                  ? "completed"
                  : "partial-received";

            const now = new Date().toISOString();
            const siteDoc = {
              _id: receiptSiteId,
              code: typeof siteSnapshot?.code === "string" ? siteSnapshot.code : "",
              name: typeof siteSnapshot?.name === "string" ? siteSnapshot.name : "",
            };
            const projectDoc = {
              _id: projectId,
              ...(current.projectSnapshot && typeof current.projectSnapshot === "object"
                ? (current.projectSnapshot as Record<string, unknown>)
                : {}),
            };
            const cancellationReference = buildReferenceSnapshot(
              "purchase_order_receipt_cancel",
              receiptNo,
              `${receiptNo}-CXL`,
              typeof current.poNo === "string" ? `${current.poNo} 입고 취소` : "입고 취소",
            );
            const cancellationTransactions = lineItems.map((item) => {
              const lineRecord =
                item && typeof item === "object" ? (item as Record<string, unknown>) : {};
              const materialDoc = {
                _id: toTrimmedString(lineRecord.materialId),
                materialCode: "",
                description: toTrimmedString(lineRecord.materialDescription),
                uom: toTrimmedString(lineRecord.uom),
              };
              return buildInventoryTransactionDocument(
                projectDoc,
                siteDoc,
                materialDoc,
                auth.profile,
                {
                  storageLocation,
                  transactionType: "issue",
                  quantity: toNumberValue(lineRecord.quantity),
                  transactionDate: now.slice(0, 10),
                  referenceSnapshot: cancellationReference,
                  status: "completed",
                },
                now,
              );
            });

            const canceledReceiptRecord = {
              ...receiptRecord,
              status: "canceled",
              canceledAt: now,
              canceledBy: buildActorSnapshot(auth.profile),
              cancelReason,
            };
            const updatedReceiptHistory =
              targetReceipt && typeof targetReceipt === "object"
                ? receiptHistory.map((entry) => {
                    const record =
                      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
                    if (toTrimmedString(record.receiptNo) !== receiptNo) {
                      return record;
                    }
                    return canceledReceiptRecord;
                  })
                : [...receiptHistory, canceledReceiptRecord];
            const lastReceivedAt = updatedReceiptHistory.reduce((latest, entry) => {
              const record =
                entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
              if (toTrimmedString(record.status || "completed") !== "completed") {
                return latest;
              }
              const transactionDate = toTrimmedString(record.transactionDate);
              if (!transactionDate) {
                return latest;
              }
              return !latest || transactionDate > latest ? transactionDate : latest;
            }, "");

            const updateResult = await transactionalDb.collection("purchase_orders").updateOne(
              { _id: new ObjectId(id) },
              {
                $set: {
                  lines: updatedLines,
                  status: nextStatus,
                  updatedAt: now,
                  updatedBy: buildActorSnapshot(auth.profile),
                  receiptSummary: {
                    orderedQuantity: orderedTotal,
                    receivedQuantity: receivedTotal,
                    remainingQuantity: Math.max(orderedTotal - receivedTotal, 0),
                    lastReceivedAt: receivedTotal > 0 ? lastReceivedAt : "",
                  },
                  receiptHistory: updatedReceiptHistory,
                },
                $inc: { documentVersion: 1 },
              },
              { session },
            );

            if (cancellationTransactions.length > 0) {
              await transactionalDb
                .collection("inventory_transactions")
                .insertMany(cancellationTransactions, { session });
            }

            return { affectedCount: updateResult.modifiedCount };
          });

          affectedCount = transactionResult?.affectedCount ?? 0;
          return NextResponse.json({
            ok: true,
            action: "cancel-receipt",
            affectedCount,
            targetIds: [id],
            receiptNo,
            reason: cancelReason,
          });
        } catch (error) {
          if (!hasRetryableTransactionLabel(error) || attempt === 2) {
            throw error;
          }
        }
      }
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      ok: true,
      action: "cancel-receipt",
      affectedCount: 0,
      targetIds: [id],
      receiptNo,
      reason: cancelReason,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
