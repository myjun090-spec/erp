import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { generateInventoryReceiptNo } from "@/lib/document-numbers";
import {
  buildInventoryTransactionDocument,
  buildReferenceSnapshot,
} from "@/lib/inventory-transactions";
import { getMongoClient, getMongoDb, getMongoDbName } from "@/lib/mongodb";
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
  const auth = await requireApiActionPermission("purchase-order.receive");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
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

    const status = String(existing.status || "");
    if (status !== "approved" && status !== "partial-received") {
      return NextResponse.json(
        { ok: false, message: "입고 등록은 승인 또는 부분 입고 상태 발주에만 적용할 수 있습니다." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const receiptLines = Array.isArray(body.receiptLines) ? body.receiptLines : [];
    const siteId = toTrimmedString(body.siteId);
    const storageLocation = toTrimmedString(body.storageLocation);
    const transactionDate = toTrimmedString(body.transactionDate) || new Date().toISOString().slice(0, 10);
    if (receiptLines.length === 0) {
      return NextResponse.json(
        { ok: false, message: "최소 1개 이상의 입고 수량이 필요합니다." },
        { status: 400 },
      );
    }
    if (!siteId || !storageLocation) {
      return NextResponse.json(
        { ok: false, message: "입고 현장과 보관위치를 입력해 주세요." },
        { status: 400 },
      );
    }
    if (!ObjectId.isValid(siteId)) {
      return NextResponse.json(
        { ok: false, message: "입고 현장 식별자가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const receiptByLineNo = new Map<number, number>();
    for (const item of receiptLines) {
      if (!item || typeof item !== "object") {
        return NextResponse.json({ ok: false, message: "입고 정보 형식이 올바르지 않습니다." }, { status: 400 });
      }

      const lineNo = toNumberValue((item as Record<string, unknown>).lineNo);
      const quantity = toNumberValue((item as Record<string, unknown>).quantity);
      if (!Number.isInteger(lineNo) || lineNo <= 0) {
        return NextResponse.json({ ok: false, message: "발주 라인 번호가 올바르지 않습니다." }, { status: 400 });
      }
      if (!Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json({ ok: false, message: "입고 수량은 0 이상의 숫자여야 합니다." }, { status: 400 });
      }

      if (quantity > 0) {
        receiptByLineNo.set(lineNo, (receiptByLineNo.get(lineNo) ?? 0) + quantity);
      }
    }

    if (receiptByLineNo.size === 0) {
      return NextResponse.json(
        { ok: false, message: "최소 1개 이상의 입고 수량을 입력해 주세요." },
        { status: 400 },
      );
    }

    const client = await getMongoClient();
    const transactionalDb = client.db(getMongoDbName());
    const session = client.startSession();
    let affectedCount = 0;
    let receiptNo = "";

    try {
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

            const currentStatus = String(current.status || "");
            if (currentStatus !== "approved" && currentStatus !== "partial-received") {
              throw new Error("입고 등록은 승인 또는 부분 입고 상태 발주에만 적용할 수 있습니다.");
            }

            const currentProjectId =
              current.projectSnapshot && typeof current.projectSnapshot === "object"
                ? String((current.projectSnapshot as Record<string, unknown>).projectId ?? "")
                : "";
            const site = await transactionalDb.collection("sites").findOne(
              {
                _id: new ObjectId(siteId),
                "projectSnapshot.projectId": currentProjectId,
                status: { $ne: "archived" },
              },
              { session },
            );
            if (!site) {
              throw new Error("입고 현장을 찾을 수 없거나 발주 프로젝트와 일치하지 않습니다.");
            }

            const projectDoc = {
              _id: currentProjectId,
              ...(current.projectSnapshot && typeof current.projectSnapshot === "object"
                ? (current.projectSnapshot as Record<string, unknown>)
                : {}),
            };

            const currentLines = Array.isArray(current.lines) ? current.lines : [];
            const updatedLines = currentLines.map((line) => {
              const record =
                line && typeof line === "object" ? (line as Record<string, unknown>) : {};
              const lineNo = toNumberValue(record.lineNo);
              const orderedQuantity = toNumberValue(record.quantity);
              const receivedQuantity = toNumberValue(record.receivedQuantity);
              const increment = receiptByLineNo.get(lineNo) ?? 0;
              const remainingQuantity = Math.max(orderedQuantity - receivedQuantity, 0);

              if (increment > remainingQuantity) {
                const materialName =
                  record.materialSnapshot && typeof record.materialSnapshot === "object"
                    ? String(
                        (record.materialSnapshot as Record<string, unknown>).description ??
                          `라인 ${lineNo}`,
                      )
                    : `라인 ${lineNo}`;
                throw new Error(
                  `${materialName}의 잔여 수량 ${remainingQuantity.toLocaleString()}개를 초과해 입고할 수 없습니다.`,
                );
              }

              return {
                ...record,
                receivedQuantity: receivedQuantity + increment,
              };
            });

            const hasUnknownLines = [...receiptByLineNo.keys()].some(
              (lineNo) =>
                !updatedLines.some(
                  (line) => toNumberValue((line as Record<string, unknown>).lineNo) === lineNo,
                ),
            );
            if (hasUnknownLines) {
              throw new Error("입고 대상 발주 라인을 찾을 수 없습니다.");
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
            const nextReceiptNo = generateInventoryReceiptNo();
            const receiptTransactions = currentLines
              .map((line) => {
                const record =
                  line && typeof line === "object" ? (line as Record<string, unknown>) : {};
                const lineNo = toNumberValue(record.lineNo);
                const increment = receiptByLineNo.get(lineNo) ?? 0;
                if (increment <= 0) {
                  return null;
                }

                const materialSnapshot =
                  record.materialSnapshot && typeof record.materialSnapshot === "object"
                    ? (record.materialSnapshot as Record<string, unknown>)
                    : null;
                const materialId =
                  typeof materialSnapshot?.materialId === "string"
                    ? materialSnapshot.materialId
                    : "";
                if (!materialId) {
                  throw new Error(`라인 ${lineNo}의 자재 정보가 올바르지 않습니다.`);
                }

                const materialDoc = {
                  _id: materialId,
                  materialCode:
                    typeof materialSnapshot?.materialCode === "string"
                      ? materialSnapshot.materialCode
                      : "",
                  description:
                    typeof materialSnapshot?.description === "string"
                      ? materialSnapshot.description
                      : "",
                  uom:
                    typeof materialSnapshot?.uom === "string" ? materialSnapshot.uom : "",
                };

                return buildInventoryTransactionDocument(
                  projectDoc,
                  site,
                  materialDoc,
                  auth.profile,
                  {
                    storageLocation,
                    transactionType: "receipt",
                    quantity: increment,
                    transactionDate,
                    referenceSnapshot: buildReferenceSnapshot(
                      "purchase_order_receipt",
                      nextReceiptNo,
                      nextReceiptNo,
                      typeof current.poNo === "string"
                        ? `${current.poNo} 입고`
                        : materialDoc.description || `라인 ${lineNo} 입고`,
                    ),
                    status: "completed",
                  },
                  now,
                );
              })
              .filter(
                (
                  value,
                ): value is ReturnType<typeof buildInventoryTransactionDocument> =>
                  value !== null,
              );

            const receiptHistory = current.receiptHistory;
            const nextReceiptHistoryEntry = {
              receiptNo: nextReceiptNo,
              transactionDate,
              siteSnapshot: {
                siteId: site._id.toString(),
                code: typeof site.code === "string" ? site.code : "",
                name: typeof site.name === "string" ? site.name : "",
              },
              storageLocation,
              status: "completed",
              lineItems: currentLines
                .map((line) => {
                  const record =
                    line && typeof line === "object" ? (line as Record<string, unknown>) : {};
                  const lineNo = toNumberValue(record.lineNo);
                  const increment = receiptByLineNo.get(lineNo) ?? 0;
                  if (increment <= 0) {
                    return null;
                  }

                  const materialSnapshot =
                    record.materialSnapshot && typeof record.materialSnapshot === "object"
                      ? (record.materialSnapshot as Record<string, unknown>)
                      : null;
                  return {
                    lineNo,
                    quantity: increment,
                    uom: typeof materialSnapshot?.uom === "string" ? materialSnapshot.uom : "",
                    materialId:
                      typeof materialSnapshot?.materialId === "string"
                        ? materialSnapshot.materialId
                        : "",
                    materialDescription:
                      typeof materialSnapshot?.description === "string"
                        ? materialSnapshot.description
                        : `라인 ${lineNo}`,
                  };
                })
                .filter(Boolean),
              createdAt: now,
              createdBy: buildActorSnapshot(auth.profile),
            };

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
                    lastReceivedAt: transactionDate,
                  },
                  receiptHistory: Array.isArray(receiptHistory)
                    ? [...receiptHistory, nextReceiptHistoryEntry]
                    : [nextReceiptHistoryEntry],
                },
                $inc: { documentVersion: 1 },
              },
              { session },
            );

            if (receiptTransactions.length > 0) {
              await transactionalDb
                .collection("inventory_transactions")
                .insertMany(receiptTransactions, { session });
            }

            return { affectedCount: updateResult.modifiedCount, receiptNo: nextReceiptNo };
          });

          affectedCount = transactionResult?.affectedCount ?? 0;
          receiptNo = transactionResult?.receiptNo ?? "";
          break;
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
      action: "receive",
      affectedCount,
      receiptNo,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
