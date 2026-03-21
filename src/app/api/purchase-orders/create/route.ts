import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildBudgetLinkSnapshots,
  buildBudgetSnapshot,
  normalizeBudgetLinkInput,
  resolveBudgetLinkDocuments,
  validateBudgetLinkInput,
} from "@/lib/budget-links";
import {
  calculateExecutionBudgetRemainingAmount,
  normalizeExecutionBudgetUsageSummary,
} from "@/lib/execution-budgets";
import { getMongoDb } from "@/lib/mongodb";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { generatePurchaseOrderNo } from "@/lib/document-numbers";
import { buildMaterialSnapshot } from "@/lib/material-snapshot";
import { buildPartySnapshot } from "@/lib/party-snapshot";
import { getProjectAccessScope } from "@/lib/project-access";
export async function POST(request: Request) {
  const auth = await requireApiActionPermission("purchase-order.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const budgetLinkInput = normalizeBudgetLinkInput(body);
    const validationError = validateBudgetLinkInput(budgetLinkInput);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
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
      return NextResponse.json({ ok: false, message: "최소 1개 이상의 발주 라인이 필요합니다." }, { status: 400 });
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
      return NextResponse.json({ ok: false, message: "발주 라인 자재 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const materialDocs = await db
      .collection("materials")
      .find({
        _id: { $in: uniqueMaterialIds.map((id) => new ObjectId(id)) },
        status: { $ne: "archived" },
      })
      .toArray();
    const materialMap = new Map(materialDocs.map((material) => [String(material._id), material]));
    if (materialMap.size !== uniqueMaterialIds.length) {
      return NextResponse.json({ ok: false, message: "선택한 자재 중 일부를 찾을 수 없습니다." }, { status: 400 });
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
      const lineAmount = quantity * unitPrice;
      return {
        lineNo: index + 1,
        materialSnapshot: buildMaterialSnapshot(material),
        quantity,
        receivedQuantity: 0,
        unitPrice,
        lineAmount,
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
    const result = await db.collection("purchase_orders").insertOne({
      poNo: generatePurchaseOrderNo(),
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
      status: resolveStatus(body.status, "draft"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
