import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot, toTrimmedString } from "@/lib/domain-write";
import type { BulkActionRequest } from "@/lib/domain-api";
import {
  buildInventoryTransactionDocument,
  buildReferenceSnapshot,
} from "@/lib/inventory-transactions";
import { getMongoClient, getMongoDbName } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { summarizeInventoryBalance } from "@/lib/inventory-transactions";

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

function isPendingInventoryRequest(doc: Record<string, unknown>) {
  return (
    ["adjustment", "issue", "transfer"].includes(toTrimmedString(doc.transactionType)) &&
    toTrimmedString(doc.status) === "pending-approval"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkActionRequest;
    const targetIds = Array.isArray(body.targetIds) ? body.targetIds : [];
    if (targetIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "대상 재고 거래를 선택해 주세요." },
        { status: 400 },
      );
    }

    const objectIds = targetIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length !== targetIds.length) {
      return NextResponse.json(
        { ok: false, message: "재고 거래 식별자가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const action = toTrimmedString(body.action);
    const rejectionReason = toTrimmedString(
      (body as BulkActionRequest & { reason?: string }).reason,
    );
    const normalizedAction =
      action === "approve-adjustment" ? "approve-inventory-request" :
      action === "reject-adjustment" ? "reject-inventory-request" :
      action;
    if (
      normalizedAction !== "approve-inventory-request" &&
      normalizedAction !== "reject-inventory-request"
    ) {
      return NextResponse.json({ ok: false, message: "지원하지 않는 액션입니다." }, { status: 400 });
    }
    if (normalizedAction === "reject-inventory-request" && !rejectionReason) {
      return NextResponse.json(
        { ok: false, message: "반려 사유를 입력해 주세요." },
        { status: 400 },
      );
    }
    const auth = await requireApiActionPermission(
      normalizedAction === "approve-inventory-request"
        ? "inventory.adjust-approve"
        : "inventory.adjust-reject",
    );
    if ("error" in auth) return auth.error;

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    const session = client.startSession();

    try {
      let affectedCount = 0;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const transactionResult = await session.withTransaction(async () => {
            const docs = await db
              .collection("inventory_transactions")
              .find({ _id: { $in: objectIds } }, { session })
              .toArray();

            if (docs.length !== objectIds.length) {
              throw new Error("선택한 재고 거래 일부를 찾을 수 없습니다.");
            }

            for (const doc of docs) {
              const projectId =
                doc.projectSnapshot && typeof doc.projectSnapshot === "object"
                  ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
                  : "";
              if (
                projectAccessScope.allowedProjectIds &&
                !projectAccessScope.allowedProjectIds.includes(projectId)
              ) {
                throw new Error("프로젝트에 접근할 수 없는 조정 거래가 포함되어 있습니다.");
              }
              if (!isPendingInventoryRequest(doc)) {
                throw new Error("승인 대기 중인 재고 요청만 처리할 수 있습니다.");
              }
              const createdByUserId =
                doc.createdBy && typeof doc.createdBy === "object"
                  ? String((doc.createdBy as Record<string, unknown>).userId ?? "")
                  : "";
              if (
                normalizedAction === "approve-inventory-request" &&
                createdByUserId &&
                createdByUserId === auth.profile.email
              ) {
                throw new Error("본인이 생성한 재고 요청은 직접 승인할 수 없습니다.");
              }
            }

            if (normalizedAction === "approve-inventory-request") {
              const decreaseBuckets = new Map<
                string,
                {
                  materialId: string;
                  projectId: string;
                  siteId: string;
                  storageLocation: string;
                  lotNo: string;
                  serialNo: string;
                  expiryDate: string;
                  qualityStatus: string;
                  amount: number;
                }
              >();
              for (const doc of docs) {
                const transactionType = toTrimmedString(doc.transactionType);
                const isDecreaseAdjustment =
                  transactionType === "adjustment" &&
                  toTrimmedString(doc.adjustmentDirection) === "decrease";
                const isIssue = transactionType === "issue";
                const isTransfer = transactionType === "transfer";
                if (!isDecreaseAdjustment && !isIssue && !isTransfer) {
                  continue;
                }

                const materialId =
                  doc.materialSnapshot && typeof doc.materialSnapshot === "object"
                    ? String((doc.materialSnapshot as Record<string, unknown>).materialId ?? "")
                    : "";
                const projectId =
                  doc.projectSnapshot && typeof doc.projectSnapshot === "object"
                    ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
                    : "";
                const siteId =
                  doc.siteSnapshot && typeof doc.siteSnapshot === "object"
                    ? String((doc.siteSnapshot as Record<string, unknown>).siteId ?? "")
                    : "";
                const storageLocation = toTrimmedString(doc.storageLocation);
                const lotNo = toTrimmedString(doc.lotNo);
                const serialNo = toTrimmedString(doc.serialNo);
                const expiryDate = toTrimmedString(doc.expiryDate);
                const qualityStatus = toTrimmedString(doc.qualityStatus) || "available";
                const bucketKey = `${materialId}:${projectId}:${siteId}:${storageLocation}:${lotNo}:${serialNo}:${expiryDate}:${qualityStatus}`;

                decreaseBuckets.set(bucketKey, {
                  materialId,
                  projectId,
                  siteId,
                  storageLocation,
                  lotNo,
                  serialNo,
                  expiryDate,
                  qualityStatus,
                  amount:
                    (decreaseBuckets.get(bucketKey)?.amount ?? 0) +
                    (typeof doc.quantity === "number" ? doc.quantity : Number(doc.quantity || 0)),
                });
              }

              for (const bucket of decreaseBuckets.values()) {
                const availableQuantity = await summarizeInventoryBalance(db, {
                  materialId: bucket.materialId,
                  projectId: bucket.projectId,
                  siteId: bucket.siteId,
                  storageLocation: bucket.storageLocation,
                  lotNo: bucket.lotNo,
                  serialNo: bucket.serialNo,
                  expiryDate: bucket.expiryDate,
                  qualityStatus: bucket.qualityStatus,
                });

                if (bucket.amount > availableQuantity) {
                  throw new Error(
                    `감액 조정 승인 수량이 현재 재고 ${availableQuantity.toLocaleString()}를 초과했습니다.`,
                  );
                }
              }
            }

            const now = new Date().toISOString();
            const updateFields =
              normalizedAction === "approve-inventory-request"
                ? {
                    status: "completed",
                    approvedAt: now,
                    approvedBy: buildActorSnapshot(auth.profile),
                    updatedAt: now,
                    updatedBy: buildActorSnapshot(auth.profile),
                  }
                : {
                    status: "rejected",
                    rejectedAt: now,
                    rejectedBy: buildActorSnapshot(auth.profile),
                    rejectionReason,
                    updatedAt: now,
                    updatedBy: buildActorSnapshot(auth.profile),
                  };

            if (normalizedAction === "approve-inventory-request") {
              const transferExecutionDocs = docs
                .filter((doc) => toTrimmedString(doc.transactionType) === "transfer")
                .flatMap((doc) => {
                  const projectSnapshot =
                    doc.projectSnapshot && typeof doc.projectSnapshot === "object"
                      ? (doc.projectSnapshot as Record<string, unknown>)
                      : null;
                  const sourceSiteSnapshot =
                    doc.siteSnapshot && typeof doc.siteSnapshot === "object"
                      ? (doc.siteSnapshot as Record<string, unknown>)
                      : null;
                  const targetSiteSnapshot =
                    doc.targetSiteSnapshot && typeof doc.targetSiteSnapshot === "object"
                      ? (doc.targetSiteSnapshot as Record<string, unknown>)
                      : null;
                  const materialSnapshot =
                    doc.materialSnapshot && typeof doc.materialSnapshot === "object"
                      ? (doc.materialSnapshot as Record<string, unknown>)
                      : null;
                  if (!projectSnapshot || !sourceSiteSnapshot || !targetSiteSnapshot || !materialSnapshot) {
                    throw new Error("이동 요청의 프로젝트, 현장 또는 자재 정보가 올바르지 않습니다.");
                  }

                  const projectDoc = {
                    _id: String(projectSnapshot.projectId ?? ""),
                    code: String(projectSnapshot.code ?? ""),
                    name: String(projectSnapshot.name ?? ""),
                  };
                  const sourceSiteDoc = {
                    _id: String(sourceSiteSnapshot.siteId ?? ""),
                    code: String(sourceSiteSnapshot.code ?? ""),
                    name: String(sourceSiteSnapshot.name ?? ""),
                  };
                  const targetSiteDoc = {
                    _id: String(targetSiteSnapshot.siteId ?? ""),
                    code: String(targetSiteSnapshot.code ?? ""),
                    name: String(targetSiteSnapshot.name ?? ""),
                  };
                  const materialDoc = {
                    _id: String(materialSnapshot.materialId ?? ""),
                    materialCode: String(materialSnapshot.materialCode ?? ""),
                    description: String(materialSnapshot.description ?? ""),
                    uom: String(materialSnapshot.uom ?? ""),
                  };
                  const transferReferenceSnapshot = buildReferenceSnapshot(
                    "inventory_transfer_execution",
                    String(doc._id),
                    doc.referenceSnapshot && typeof doc.referenceSnapshot === "object"
                      ? String((doc.referenceSnapshot as Record<string, unknown>).referenceNo ?? "")
                      : "",
                    doc.referenceSnapshot && typeof doc.referenceSnapshot === "object"
                      ? String((doc.referenceSnapshot as Record<string, unknown>).referenceName ?? "재고 이동")
                      : "재고 이동",
                  );

                  return [
                    buildInventoryTransactionDocument(
                      projectDoc,
                      sourceSiteDoc,
                      materialDoc,
                      auth.profile,
                      {
                        storageLocation: toTrimmedString(doc.storageLocation),
                        transactionType: "issue",
                        quantity:
                          typeof doc.quantity === "number" ? doc.quantity : Number(doc.quantity || 0),
                        transactionDate: toTrimmedString(doc.transactionDate),
                        lotNo: toTrimmedString(doc.lotNo),
                        serialNo: toTrimmedString(doc.serialNo),
                        expiryDate: toTrimmedString(doc.expiryDate),
                        qualityStatus: toTrimmedString(doc.qualityStatus) || "available",
                        referenceSnapshot: transferReferenceSnapshot,
                        status: "completed",
                      },
                      now,
                    ),
                    buildInventoryTransactionDocument(
                      projectDoc,
                      targetSiteDoc,
                      materialDoc,
                      auth.profile,
                      {
                        storageLocation: toTrimmedString(doc.targetStorageLocation),
                        transactionType: "receipt",
                        quantity:
                          typeof doc.quantity === "number" ? doc.quantity : Number(doc.quantity || 0),
                        transactionDate: toTrimmedString(doc.transactionDate),
                        lotNo: toTrimmedString(doc.lotNo),
                        serialNo: toTrimmedString(doc.serialNo),
                        expiryDate: toTrimmedString(doc.expiryDate),
                        qualityStatus: toTrimmedString(doc.qualityStatus) || "available",
                        referenceSnapshot: transferReferenceSnapshot,
                        status: "completed",
                      },
                      now,
                    ),
                  ];
                });

              if (transferExecutionDocs.length > 0) {
                await db.collection("inventory_transactions").insertMany(transferExecutionDocs, {
                  session,
                });
              }
            }

            const result = await db.collection("inventory_transactions").updateMany(
              {
                _id: { $in: objectIds },
                status: "pending-approval",
                transactionType: { $in: ["adjustment", "issue", "transfer"] },
              },
              { $set: updateFields },
              { session },
            );

            return { affectedCount: result.modifiedCount };
          });

          affectedCount = transactionResult?.affectedCount ?? 0;
          return NextResponse.json({
            ok: true,
            action: normalizedAction,
            affectedCount,
            targetIds,
          });
        } catch (error) {
          if (!hasRetryableTransactionLabel(error) || attempt === 2) {
            throw error;
          }
        }
      }

      return NextResponse.json({
        ok: true,
        action: normalizedAction,
        affectedCount,
        targetIds,
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
