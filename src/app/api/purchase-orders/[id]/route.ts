import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildBudgetLinkSnapshots,
  buildBudgetSnapshot,
  normalizeBudgetLinkInput,
  resolveBudgetLinkDocuments,
  validateBudgetLinkInput,
} from "@/lib/budget-links";
import { buildActorSnapshot, stripProtectedCreateFields, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import {
  calculateExecutionBudgetRemainingAmount,
  normalizeExecutionBudgetUsageSummary,
} from "@/lib/execution-budgets";
import { buildMaterialSnapshot } from "@/lib/material-snapshot";
import { getMongoDb } from "@/lib/mongodb";
import { buildPartySnapshot } from "@/lib/party-snapshot";
import { buildPurchaseOrderBillingSummary } from "@/lib/purchase-order-billing";
import { getProjectAccessScope } from "@/lib/project-access";
import { canEditPurchaseOrder } from "@/lib/purchase-order-status";

async function buildFallbackReceiptHistory(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  purchaseOrderId: string,
) {
  const docs = await db
    .collection("inventory_transactions")
    .find({
      transactionType: "receipt",
      $or: [
        {
          "referenceSnapshot.referenceType": "purchase_order_receipt",
        },
        {
          "referenceSnapshot.referenceType": "purchase_order",
          "referenceSnapshot.referenceId": purchaseOrderId,
        },
      ],
    })
    .project({
      createdAt: 1,
      transactionDate: 1,
      storageLocation: 1,
      siteSnapshot: 1,
      materialSnapshot: 1,
      quantity: 1,
      uom: 1,
      referenceSnapshot: 1,
    })
    .sort({ transactionDate: 1, createdAt: 1, _id: 1 })
    .toArray();

  const buckets = new Map<
    string,
    {
      receiptNo: string;
      transactionDate: string;
      storageLocation: string;
      status: string;
      siteSnapshot: { siteId: string; code: string; name: string } | null;
      lineItems: {
        lineNo: number;
        quantity: number;
        uom: string;
        materialId: string;
        materialDescription: string;
      }[];
      createdAt: string;
    }
  >();

  for (const doc of docs) {
    const referenceSnapshot =
      doc.referenceSnapshot && typeof doc.referenceSnapshot === "object"
        ? (doc.referenceSnapshot as Record<string, unknown>)
        : {};
    const siteSnapshot =
      doc.siteSnapshot && typeof doc.siteSnapshot === "object"
        ? (doc.siteSnapshot as Record<string, unknown>)
        : {};
    const materialSnapshot =
      doc.materialSnapshot && typeof doc.materialSnapshot === "object"
        ? (doc.materialSnapshot as Record<string, unknown>)
        : {};

    const legacyKey = `${String(doc.createdAt ?? "")}:${String(doc.transactionDate ?? "")}:${String(siteSnapshot.siteId ?? "")}:${String(doc.storageLocation ?? "")}`;
    const receiptNo =
      typeof referenceSnapshot.referenceNo === "string" && referenceSnapshot.referenceNo
        ? referenceSnapshot.referenceNo
        : `LEGACY-${String(doc._id)}`;
    const bucketKey =
      typeof referenceSnapshot.referenceType === "string" &&
      referenceSnapshot.referenceType === "purchase_order_receipt"
        ? receiptNo
        : legacyKey;

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        receiptNo:
          typeof referenceSnapshot.referenceType === "string" &&
          referenceSnapshot.referenceType === "purchase_order_receipt"
            ? receiptNo
            : `LEGACY-${String(doc._id)}`,
        transactionDate: typeof doc.transactionDate === "string" ? doc.transactionDate : "",
        storageLocation: typeof doc.storageLocation === "string" ? doc.storageLocation : "",
        status: "completed",
        siteSnapshot: {
          siteId: typeof siteSnapshot.siteId === "string" ? siteSnapshot.siteId : "",
          code: typeof siteSnapshot.code === "string" ? siteSnapshot.code : "",
          name: typeof siteSnapshot.name === "string" ? siteSnapshot.name : "",
        },
        lineItems: [],
        createdAt: typeof doc.createdAt === "string" ? doc.createdAt : "",
      });
    }

    const bucket = buckets.get(bucketKey);
    if (!bucket) {
      continue;
    }
    bucket.lineItems.push({
      lineNo: bucket.lineItems.length + 1,
      quantity: toNumberValue(doc.quantity),
      uom: typeof doc.uom === "string" ? doc.uom : "",
      materialId: typeof materialSnapshot.materialId === "string" ? materialSnapshot.materialId : "",
      materialDescription:
        typeof materialSnapshot.description === "string" ? materialSnapshot.description : "-",
    });
  }

  return [...buckets.values()];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("purchase_orders").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (projectAccessScope.allowedProjectIds && !projectAccessScope.allowedProjectIds.includes(projectId)) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }
    const [billingSummary, siteDocs, fallbackReceiptHistory] = await Promise.all([
      buildPurchaseOrderBillingSummary(db, doc),
      db
        .collection("sites")
        .find({ "projectSnapshot.projectId": projectId, status: { $ne: "archived" } })
        .project({ code: 1, name: 1 })
        .sort({ code: 1, name: 1 })
        .limit(100)
        .toArray(),
      buildFallbackReceiptHistory(db, id),
    ]);

    const availableSites = siteDocs.map((site) => ({
      siteId: site._id.toString(),
      code: typeof site.code === "string" ? site.code : "",
      name: typeof site.name === "string" ? site.name : "",
    }));
    const receiptHistory =
      Array.isArray(doc.receiptHistory) && doc.receiptHistory.length > 0
        ? doc.receiptHistory
        : fallbackReceiptHistory;
    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
        billingSummary,
        availableSites,
        receiptHistory,
      },
    });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("purchase-order.update");
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
    const existingProjectId =
      existing.projectSnapshot && typeof existing.projectSnapshot === "object"
        ? String((existing.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !projectAccessScope.allowedProjectIds.includes(existingProjectId)
    ) {
      return NextResponse.json({ ok: false, message: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!canEditPurchaseOrder(String(existing.status || ""))) {
      return NextResponse.json(
        { ok: false, message: "초안 또는 제출 상태 발주만 수정할 수 있습니다." },
        { status: 400 },
      );
    }

    const body = stripProtectedCreateFields(await request.json());
    const budgetLinkInput = normalizeBudgetLinkInput(body);
    const validationError = validateBudgetLinkInput(budgetLinkInput);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }

    const resolvedBudgetLink = await resolveBudgetLinkDocuments(
      db,
      budgetLinkInput,
      projectAccessScope.allowedProjectIds,
    );
    if ("error" in resolvedBudgetLink) {
      return NextResponse.json({ ok: false, message: resolvedBudgetLink.error }, { status: 400 });
    }

    const budgetSnapshot = buildBudgetSnapshot(resolvedBudgetLink.budget);
    const budgetUsageSummary = normalizeExecutionBudgetUsageSummary(
      resolvedBudgetLink.budget.usageSummary,
    );
    const remainingBudgetAmount = Math.max(
      calculateExecutionBudgetRemainingAmount(budgetSnapshot.totalAmount, budgetUsageSummary),
      0,
    );

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) {
      return NextResponse.json(
        { ok: false, message: "최소 1개 이상의 발주 라인이 필요합니다." },
        { status: 400 },
      );
    }

    const materialIds = rawLines
      .map((line) => {
        if (!line || typeof line !== "object") {
          return "";
        }
        return toTrimmedString((line as Record<string, unknown>).materialId);
      })
      .filter((value) => value && ObjectId.isValid(value));
    const uniqueMaterialIds = [...new Set(materialIds)];
    if (materialIds.length !== rawLines.length) {
      return NextResponse.json(
        { ok: false, message: "발주 라인 자재 식별자가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const materialDocs = await db
      .collection("materials")
      .find({
        _id: { $in: uniqueMaterialIds.map((materialId) => new ObjectId(materialId)) },
        status: { $ne: "archived" },
      })
      .toArray();
    const materialMap = new Map(materialDocs.map((material) => [String(material._id), material]));
    if (materialMap.size !== uniqueMaterialIds.length) {
      return NextResponse.json(
        { ok: false, message: "선택한 자재 중 일부를 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    const normalizedLines = rawLines.map((line, index) => {
      const record = line as Record<string, unknown>;
      const materialId = toTrimmedString(record.materialId);
      const material = materialMap.get(materialId);
      if (!material) {
        throw new Error("선택한 자재를 찾을 수 없습니다.");
      }
      const quantity = toNumberValue(record.quantity);
      const unitPrice = toNumberValue(record.unitPrice);
      if (quantity <= 0) {
        throw new Error("발주 라인 수량은 1 이상이어야 합니다.");
      }
      if (unitPrice < 0) {
        throw new Error("발주 라인 단가는 0 이상이어야 합니다.");
      }
      return {
        lineNo: index + 1,
        materialSnapshot: buildMaterialSnapshot(material),
        quantity,
        receivedQuantity: 0,
        unitPrice,
        lineAmount: quantity * unitPrice,
      };
    });

    const requestedAmount = normalizedLines.reduce(
      (sum, line) => sum + toNumberValue(line.lineAmount),
      0,
    );
    if (requestedAmount > remainingBudgetAmount) {
      return NextResponse.json(
        {
          ok: false,
          message: `발주 총액이 실행예산 남은 금액 ${remainingBudgetAmount.toLocaleString()}원을 초과했습니다.`,
        },
        { status: 400 },
      );
    }

    const vendorId = toTrimmedString(body.vendorId);
    if (!vendorId) {
      return NextResponse.json({ ok: false, message: "공급업체를 선택해 주세요." }, { status: 400 });
    }
    if (!ObjectId.isValid(vendorId)) {
      return NextResponse.json({ ok: false, message: "공급업체 식별자가 올바르지 않습니다." }, { status: 400 });
    }

    const vendor = await db.collection("parties").findOne({
      _id: new ObjectId(vendorId),
      partyRoles: "vendor",
      status: { $ne: "archived" },
    });
    if (!vendor) {
      return NextResponse.json({ ok: false, message: "선택한 공급업체를 찾을 수 없습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("purchase_orders").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...buildBudgetLinkSnapshots(
            resolvedBudgetLink.project,
            resolvedBudgetLink.wbs,
            resolvedBudgetLink.budget,
          ),
          vendorSnapshot: buildPartySnapshot(vendor),
          orderDate: toTrimmedString(body.orderDate),
          dueDate: toTrimmedString(body.dueDate),
          totalAmount: requestedAmount,
          currency: toTrimmedString(body.currency) || "KRW",
          lines: normalizedLines,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
