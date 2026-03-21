import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildApPaymentSummary } from "@/lib/ap-payments";
import {
  buildBudgetLinkSnapshots,
  normalizeBudgetLinkInput,
  resolveBudgetLinkDocuments,
  validateBudgetLinkInput,
} from "@/lib/budget-links";
import {
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { generateApInvoiceNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { buildPartySnapshot } from "@/lib/party-snapshot";
import { buildPurchaseOrderBillingSummary } from "@/lib/purchase-order-billing";
import { getProjectAccessScope } from "@/lib/project-access";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("ap.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const purchaseOrderId = toTrimmedString(body.purchaseOrderId);
    let budgetLinkSnapshots: ReturnType<typeof buildBudgetLinkSnapshots> | null = null;
    let vendorSnapshot: Record<string, unknown> | null = null;
    let sourceSnapshot: Record<string, unknown> | undefined;

    if (purchaseOrderId) {
      if (!ObjectId.isValid(purchaseOrderId)) {
        return NextResponse.json({ ok: false, message: "참조 발주 식별자가 올바르지 않습니다." }, { status: 400 });
      }

      const purchaseOrder = await db.collection("purchase_orders").findOne({ _id: new ObjectId(purchaseOrderId) });
      if (!purchaseOrder) {
        return NextResponse.json({ ok: false, message: "참조 발주를 찾을 수 없습니다." }, { status: 404 });
      }
      const projectId =
        purchaseOrder.projectSnapshot && typeof purchaseOrder.projectSnapshot === "object"
          ? String((purchaseOrder.projectSnapshot as Record<string, unknown>).projectId ?? "")
          : "";
      if (projectAccessScope.allowedProjectIds && !projectAccessScope.allowedProjectIds.includes(projectId)) {
        return NextResponse.json({ ok: false, message: "참조 발주에 접근할 수 없습니다." }, { status: 403 });
      }
      const purchaseOrderStatus = toTrimmedString(purchaseOrder.status);
      if (!["partial-received", "completed"].includes(purchaseOrderStatus)) {
        return NextResponse.json({ ok: false, message: "부분 입고 또는 입고 완료된 발주만 AP로 참조할 수 있습니다." }, { status: 400 });
      }

      const requestedTotalAmount =
        typeof body.totalAmount === "number" ? body.totalAmount : Number(body.totalAmount || 0);
      const billingSummary = await buildPurchaseOrderBillingSummary(db, purchaseOrder);
      if (requestedTotalAmount > billingSummary.remainingBillableAmount) {
        return NextResponse.json(
          {
            ok: false,
            message: `AP 금액이 남은 청구 가능 금액 ${billingSummary.remainingBillableAmount.toLocaleString()}원을 초과했습니다.`,
          },
          { status: 400 },
        );
      }

      const linkedProject = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
      const wbsId =
        purchaseOrder.wbsSnapshot && typeof purchaseOrder.wbsSnapshot === "object"
          ? String((purchaseOrder.wbsSnapshot as Record<string, unknown>).wbsId ?? "")
          : "";
      const budgetId =
        purchaseOrder.budgetSnapshot && typeof purchaseOrder.budgetSnapshot === "object"
          ? String((purchaseOrder.budgetSnapshot as Record<string, unknown>).budgetId ?? "")
          : "";
      const linkedWbs = ObjectId.isValid(wbsId)
        ? await db.collection("wbs_items").findOne({ _id: new ObjectId(wbsId) })
        : null;
      const linkedBudget = ObjectId.isValid(budgetId)
        ? await db.collection("execution_budgets").findOne({ _id: new ObjectId(budgetId) })
        : null;
      if (!linkedProject || !linkedWbs || !linkedBudget) {
        return NextResponse.json({ ok: false, message: "참조 발주의 프로젝트/WBS/실행예산 연결이 올바르지 않습니다." }, { status: 400 });
      }

      budgetLinkSnapshots = buildBudgetLinkSnapshots(linkedProject, linkedWbs, linkedBudget);
      vendorSnapshot =
        purchaseOrder.vendorSnapshot && typeof purchaseOrder.vendorSnapshot === "object"
          ? (purchaseOrder.vendorSnapshot as Record<string, unknown>)
          : null;
      sourceSnapshot = {
        sourceType: "purchase_order",
        sourceId: purchaseOrderId,
        refNo: toTrimmedString(purchaseOrder.poNo),
      };
    } else {
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
      budgetLinkSnapshots = buildBudgetLinkSnapshots(
        resolvedBudgetLink.project,
        resolvedBudgetLink.wbs,
        resolvedBudgetLink.budget,
      );

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
      vendorSnapshot = buildPartySnapshot(vendor);
    }

    const totalAmount =
      typeof body.totalAmount === "number" ? body.totalAmount : Number(body.totalAmount || 0);
    const paymentSummary = buildApPaymentSummary({
      totalAmount,
      paymentHistory: [],
      status: "pending",
      paymentSummary: {
        paidAmount: 0,
        remainingAmount: totalAmount,
        lastPaidAt: "",
        lastPaymentMethod: "",
      },
    });

    const result = await db.collection("ap_invoices").insertOne({
      ...body,
      invoiceNo: generateApInvoiceNo(),
      totalAmount,
      ...budgetLinkSnapshots,
      vendorSnapshot,
      ...(sourceSnapshot ? { sourceSnapshot } : {}),
      status: resolveStatus(body.status, "pending"),
      paymentHistory: [],
      paymentSummary: {
        ...paymentSummary,
        paidAt: "",
      },
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
