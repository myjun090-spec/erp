import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { toNumberValue, toTrimmedString } from "@/lib/domain-write";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";
import { generateInventoryTransferNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildSiteSnapshot } from "@/lib/project-units";
import {
  buildProjectFilter,
  getProjectIdFromRequest,
  hasProjectAccess,
} from "@/lib/project-scope";
import {
  buildInventoryTransactionDocument,
  buildReferenceSnapshot,
  normalizeInventoryTransactionType,
  normalizeInventoryTransactionStatus,
  summarizeInventoryBalance,
} from "@/lib/inventory-transactions";

type InventoryTransactionItem = {
  _id: string;
  materialSnapshot: {
    materialId: string;
    materialCode: string;
    description: string;
    uom: string;
  } | null;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  siteSnapshot: {
    siteId: string;
    code: string;
    name: string;
  } | null;
  storageLocation: string;
  transactionType: string;
  adjustmentDirection: string;
  adjustmentReason: string;
  quantity: number;
  uom: string;
  transactionDate: string;
  referenceSnapshot: {
    referenceType: string;
    referenceId: string;
    referenceNo: string;
    referenceName: string;
  } | null;
  targetSiteSnapshot: {
    siteId: string;
    code: string;
    name: string;
  } | null;
  targetStorageLocation: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
  status: string;
  rejectionReason: string;
  approvedAt: string;
  rejectedAt: string;
  updatedAt: string;
};

type InventorySummaryItem = {
  _id: string;
  materialSnapshot: {
    materialId: string;
    materialCode: string;
    description: string;
    uom: string;
  } | null;
  projectSnapshot: {
    projectId: string;
    code: string;
    name: string;
  } | null;
  siteSnapshot: {
    siteId: string;
    code: string;
    name: string;
  } | null;
  storageLocation: string;
  currentQuantity: number;
  uom: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
  lastTransactionDate: string;
};

export async function GET(request: Request) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const includeZero =
      new URL(request.url).searchParams.get("includeZero") === "true";
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const matchFilter = buildProjectFilter(
      projectId,
      {
        status: { $ne: "archived" },
        "referenceSnapshot.referenceType": { $ne: "inventory_transfer_execution" },
      },
      projectAccessScope.allowedProjectIds,
    );
    const [docs, summaryDocs] = await Promise.all([
      db
        .collection("inventory_transactions")
        .find(matchFilter)
        .sort({ transactionDate: -1, updatedAt: -1, createdAt: -1 })
        .limit(200)
        .toArray(),
      db
        .collection("inventory_transactions")
        .aggregate([
          {
            $match: {
              ...matchFilter,
              $or: [
                { status: "completed" },
                { status: "confirmed" },
                { status: { $exists: false } },
                { status: "" },
              ],
            },
          },
          {
            $group: {
              _id: {
                materialId: "$materialSnapshot.materialId",
                materialCode: "$materialSnapshot.materialCode",
                description: "$materialSnapshot.description",
                projectId: "$projectSnapshot.projectId",
                projectCode: "$projectSnapshot.code",
                projectName: "$projectSnapshot.name",
                siteId: "$siteSnapshot.siteId",
                siteCode: "$siteSnapshot.code",
                siteName: "$siteSnapshot.name",
                storageLocation: "$storageLocation",
                uom: "$uom",
                lotNo: "$lotNo",
                serialNo: "$serialNo",
                expiryDate: "$expiryDate",
                qualityStatus: "$qualityStatus",
              },
              currentQuantity: {
                $sum: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ["$transactionType", "transfer"] },
                        then: 0,
                      },
                      {
                        case: { $eq: ["$transactionType", "issue"] },
                        then: { $multiply: ["$quantity", -1] },
                      },
                      {
                        case: {
                          $and: [
                            { $eq: ["$transactionType", "adjustment"] },
                            { $eq: ["$adjustmentDirection", "decrease"] },
                          ],
                        },
                        then: { $multiply: ["$quantity", -1] },
                      },
                    ],
                    default: "$quantity",
                  },
                },
              },
              lastTransactionDate: { $max: "$transactionDate" },
            },
          },
          ...(includeZero
            ? []
            : [
                {
                  $match: {
                    currentQuantity: { $ne: 0 },
                  },
                },
              ]),
          {
            $sort: {
              "_id.projectCode": 1,
              "_id.siteCode": 1,
              "_id.materialCode": 1,
              "_id.storageLocation": 1,
            },
          },
          { $limit: 200 },
        ])
        .toArray(),
    ]);

    const items: InventoryTransactionItem[] = docs.map((doc) => ({
      _id: doc._id.toString(),
      materialSnapshot:
        doc.materialSnapshot && typeof doc.materialSnapshot === "object"
          ? {
              materialId: String(
                (doc.materialSnapshot as Record<string, unknown>).materialId ?? "",
              ),
              materialCode: String(
                (doc.materialSnapshot as Record<string, unknown>).materialCode ?? "",
              ),
              description: String(
                (doc.materialSnapshot as Record<string, unknown>).description ?? "",
              ),
              uom: String((doc.materialSnapshot as Record<string, unknown>).uom ?? ""),
            }
          : null,
      projectSnapshot:
        doc.projectSnapshot && typeof doc.projectSnapshot === "object"
          ? {
              projectId: String(
                (doc.projectSnapshot as Record<string, unknown>).projectId ?? "",
              ),
              code: String((doc.projectSnapshot as Record<string, unknown>).code ?? ""),
              name: String((doc.projectSnapshot as Record<string, unknown>).name ?? ""),
            }
          : null,
      siteSnapshot:
        doc.siteSnapshot && typeof doc.siteSnapshot === "object"
          ? {
              siteId: String((doc.siteSnapshot as Record<string, unknown>).siteId ?? ""),
              code: String((doc.siteSnapshot as Record<string, unknown>).code ?? ""),
              name: String((doc.siteSnapshot as Record<string, unknown>).name ?? ""),
            }
          : null,
      storageLocation: toTrimmedString(doc.storageLocation),
      transactionType: normalizeInventoryTransactionType(doc.transactionType),
      adjustmentDirection: toTrimmedString(doc.adjustmentDirection),
      adjustmentReason: toTrimmedString(doc.adjustmentReason),
      quantity: toNumberValue(doc.quantity),
      uom: toTrimmedString(doc.uom),
      transactionDate: toTrimmedString(doc.transactionDate),
      referenceSnapshot:
        doc.referenceSnapshot && typeof doc.referenceSnapshot === "object"
          ? {
              referenceType: String(
                (doc.referenceSnapshot as Record<string, unknown>).referenceType ?? "",
              ),
              referenceId: String(
                (doc.referenceSnapshot as Record<string, unknown>).referenceId ?? "",
              ),
              referenceNo: String(
                (doc.referenceSnapshot as Record<string, unknown>).referenceNo ?? "",
              ),
              referenceName: String(
                (doc.referenceSnapshot as Record<string, unknown>).referenceName ?? "",
              ),
            }
          : null,
      targetSiteSnapshot:
        doc.targetSiteSnapshot && typeof doc.targetSiteSnapshot === "object"
          ? {
              siteId: String(
                (doc.targetSiteSnapshot as Record<string, unknown>).siteId ?? "",
              ),
              code: String((doc.targetSiteSnapshot as Record<string, unknown>).code ?? ""),
              name: String((doc.targetSiteSnapshot as Record<string, unknown>).name ?? ""),
            }
          : null,
      targetStorageLocation: toTrimmedString(doc.targetStorageLocation),
      lotNo: toTrimmedString(doc.lotNo),
      serialNo: toTrimmedString(doc.serialNo),
      expiryDate: toTrimmedString(doc.expiryDate),
      qualityStatus: toTrimmedString(doc.qualityStatus) || "available",
      status: normalizeInventoryTransactionStatus(doc.status),
      rejectionReason: toTrimmedString(doc.rejectionReason),
      approvedAt: toTrimmedString(doc.approvedAt),
      rejectedAt: toTrimmedString(doc.rejectedAt),
      updatedAt: toTrimmedString(doc.updatedAt),
    }));
    const summary: InventorySummaryItem[] = summaryDocs.map((doc) => {
      const summaryId =
        doc._id && typeof doc._id === "object" ? (doc._id as Record<string, unknown>) : {};

      return {
        _id: `${String(summaryId.materialId ?? "")}:${String(summaryId.projectId ?? "")}:${String(summaryId.siteId ?? "")}:${String(summaryId.storageLocation ?? "")}:${String(summaryId.lotNo ?? "")}:${String(summaryId.serialNo ?? "")}:${String(summaryId.expiryDate ?? "")}:${String(summaryId.qualityStatus ?? "")}`,
        materialSnapshot: {
          materialId: String(summaryId.materialId ?? ""),
          materialCode: String(summaryId.materialCode ?? ""),
          description: String(summaryId.description ?? ""),
          uom: String(summaryId.uom ?? ""),
        },
        projectSnapshot: {
          projectId: String(summaryId.projectId ?? ""),
          code: String(summaryId.projectCode ?? ""),
          name: String(summaryId.projectName ?? ""),
        },
        siteSnapshot: {
          siteId: String(summaryId.siteId ?? ""),
          code: String(summaryId.siteCode ?? ""),
          name: String(summaryId.siteName ?? ""),
        },
        storageLocation: String(summaryId.storageLocation ?? ""),
        currentQuantity: toNumberValue(doc.currentQuantity),
        uom: String(summaryId.uom ?? ""),
        lotNo: String(summaryId.lotNo ?? ""),
        serialNo: String(summaryId.serialNo ?? ""),
        expiryDate: String(summaryId.expiryDate ?? ""),
        qualityStatus: String(summaryId.qualityStatus ?? "available"),
        lastTransactionDate: toTrimmedString(doc.lastTransactionDate),
      };
    });

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items, summary },
      meta: { total: items.length, defaultProjectId: projectAccessScope.defaultProjectId },
    } satisfies DomainApiSuccessEnvelope<{ items: InventoryTransactionItem[]; summary: InventorySummaryItem[] }>);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transactionType = normalizeInventoryTransactionType(body.transactionType);
    const auth = await requireApiActionPermission(
      transactionType === "issue"
        ? "inventory.issue"
        : transactionType === "transfer"
          ? "inventory.transfer"
          : transactionType === "adjustment"
            ? "inventory.adjust-request"
            : "inventory.receipt",
    );
    if ("error" in auth) return auth.error;
    const db = await getMongoDb();
    const projectId = toTrimmedString(body.projectId);
    const siteId = toTrimmedString(body.siteId);
    const materialId = toTrimmedString(body.materialId);
    const storageLocation = toTrimmedString(body.storageLocation);
    const targetSiteId = toTrimmedString(body.targetSiteId);
    const targetStorageLocation = toTrimmedString(body.targetStorageLocation);
    const adjustmentDirection = toTrimmedString(body.adjustmentDirection);
    const adjustmentReason = toTrimmedString(body.adjustmentReason);
    const lotNo = toTrimmedString(body.lotNo);
    const serialNo = toTrimmedString(body.serialNo);
    const expiryDate = toTrimmedString(body.expiryDate);
    const qualityStatus = toTrimmedString(body.qualityStatus) || "available";
    const quantity = toNumberValue(body.quantity);
    const transactionDate = toTrimmedString(body.transactionDate);
    if (!projectId || !materialId || !transactionDate) {
      return NextResponse.json(
        { ok: false, message: "프로젝트, 자재, 거래일은 필수입니다." },
        { status: 400 },
      );
    }
    if (
      !siteId ||
      !storageLocation ||
      (transactionType === "transfer" && (!targetSiteId || !targetStorageLocation))
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            transactionType === "transfer"
              ? "출발 현장, 출발 보관위치, 도착 현장, 도착 보관위치를 입력해 주세요."
              : "현장과 보관위치를 입력해 주세요.",
        },
        { status: 400 },
      );
    }
    if (quantity <= 0) {
      return NextResponse.json(
        { ok: false, message: "재고 거래 수량은 0보다 커야 합니다." },
        { status: 400 },
      );
    }
    if (
      !ObjectId.isValid(projectId) ||
      !ObjectId.isValid(siteId) ||
      !ObjectId.isValid(materialId) ||
      (targetSiteId && !ObjectId.isValid(targetSiteId))
    ) {
      return NextResponse.json(
        { ok: false, message: "프로젝트, 현장 또는 자재 식별자가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    if (
      transactionType === "adjustment" &&
      (!adjustmentReason || !["increase", "decrease"].includes(adjustmentDirection))
    ) {
      return NextResponse.json(
        { ok: false, message: "조정은 증감 방향과 조정 사유가 필요합니다." },
        { status: 400 },
      );
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    if (!hasProjectAccess(projectId, projectAccessScope.allowedProjectIds)) {
      return NextResponse.json({ ok: false, message: "프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }

    const [project, site, targetSite, material] = await Promise.all([
      db.collection("projects").findOne({ _id: new ObjectId(projectId), status: { $ne: "archived" } }),
      db.collection("sites").findOne({ _id: new ObjectId(siteId), status: { $ne: "archived" } }),
      targetSiteId
        ? db.collection("sites").findOne({ _id: new ObjectId(targetSiteId), status: { $ne: "archived" } })
        : Promise.resolve(null),
      db.collection("materials").findOne({ _id: new ObjectId(materialId), status: { $ne: "archived" } }),
    ]);

    if (!project || !site || !material) {
      return NextResponse.json(
        { ok: false, message: "프로젝트, 현장 또는 자재를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const siteProjectId =
      site.projectSnapshot && typeof site.projectSnapshot === "object"
        ? String((site.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (siteProjectId !== projectId) {
      return NextResponse.json(
        { ok: false, message: "선택한 현장이 프로젝트와 일치하지 않습니다." },
        { status: 400 },
      );
    }
    if (transactionType === "transfer") {
      const targetProjectId =
        targetSite?.projectSnapshot && typeof targetSite.projectSnapshot === "object"
          ? String((targetSite.projectSnapshot as Record<string, unknown>).projectId ?? "")
          : "";
      if (!targetSite || targetProjectId !== projectId) {
        return NextResponse.json(
          { ok: false, message: "도착 현장을 찾을 수 없거나 프로젝트와 일치하지 않습니다." },
          { status: 400 },
        );
      }
      if (siteId === targetSiteId && storageLocation === targetStorageLocation) {
        return NextResponse.json(
          { ok: false, message: "출발 위치와 도착 위치가 동일합니다." },
          { status: 400 },
        );
      }
    }

    if (
      transactionType === "issue" ||
      transactionType === "transfer" ||
      (transactionType === "adjustment" && adjustmentDirection === "decrease")
    ) {
      const availableQuantity = await summarizeInventoryBalance(db, {
        materialId,
        projectId,
        siteId,
        storageLocation,
        lotNo,
        serialNo,
        expiryDate,
        qualityStatus,
      });
      if (quantity > availableQuantity) {
        return NextResponse.json(
          {
            ok: false,
            message: `${
              transactionType === "transfer"
                ? "이동 수량이"
                : transactionType === "adjustment"
                  ? "감액 조정 수량이"
                  : "출고 수량이"
            } 현재 재고 ${availableQuantity.toLocaleString()}${
              toTrimmedString(material.uom) || ""
            }를 초과했습니다.`,
          },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    const referenceType = toTrimmedString(body.referenceType);
    const referenceId = toTrimmedString(body.referenceId);
    const referenceNo = toTrimmedString(body.referenceNo);
    const referenceName = toTrimmedString(body.referenceName);

    if (transactionType === "transfer" && targetSite) {
      const transferNo = generateInventoryTransferNo();
      const transferReferenceSnapshot = buildReferenceSnapshot(
        referenceType || "transfer",
        "",
        referenceNo || transferNo,
        referenceName || "재고 이동",
      );
      const result = await db.collection("inventory_transactions").insertOne(
        buildInventoryTransactionDocument(
          project,
          site,
          material,
          auth.profile,
          {
            storageLocation,
            transactionType: "transfer",
            quantity,
            transactionDate,
            adjustmentDirection,
            adjustmentReason,
            targetSiteSnapshot: buildSiteSnapshot(targetSite),
            targetStorageLocation,
            lotNo,
            serialNo,
            expiryDate,
            qualityStatus,
            referenceSnapshot: transferReferenceSnapshot,
            status: "pending-approval",
          },
          now,
        ),
      );

      return NextResponse.json(
        {
          ok: true,
          data: {
            _id: result.insertedId.toString(),
            transferNo,
          },
        },
        { status: 201 },
      );
    }

    const result = await db.collection("inventory_transactions").insertOne(
      buildInventoryTransactionDocument(
        project,
        site,
        material,
        auth.profile,
        {
          storageLocation,
          transactionType,
          quantity,
          transactionDate,
          adjustmentDirection: transactionType === "adjustment" ? adjustmentDirection : "",
          adjustmentReason: transactionType === "adjustment" ? adjustmentReason : "",
          lotNo,
          serialNo,
          expiryDate,
          qualityStatus,
          referenceSnapshot:
            referenceType || referenceId || referenceNo || referenceName
              ? buildReferenceSnapshot(referenceType, referenceId, referenceNo, referenceName)
              : null,
          status:
            transactionType === "adjustment" || transactionType === "issue"
              ? "pending-approval"
              : "completed",
        },
        now,
      ),
    );

    return NextResponse.json(
      { ok: true, data: { _id: result.insertedId.toString() } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
