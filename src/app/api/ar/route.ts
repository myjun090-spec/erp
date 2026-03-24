import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildContractBillingSummary, buildContractSnapshot } from "@/lib/contract-billing";
import { buildArChangeHistoryEntry } from "@/lib/ar-history";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { buildArCollectionSummary } from "@/lib/ar-collections";
import { generateArInvoiceNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { buildPartySnapshot } from "@/lib/party-snapshot";
import { getFacilityAccessScope } from "@/lib/facility-access";
// buildProjectSnapshot removed - using facilitySnapshot
export async function POST(request: Request) {
  const auth = await requireApiActionPermission("ar.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const customerPartyId = typeof body.customerPartyId === "string" ? body.customerPartyId.trim() : "";
    if (!customerPartyId) {
      return NextResponse.json({ ok: false, message: "고객을 선택해 주세요." }, { status: 400 });
    }
    if (!ObjectId.isValid(customerPartyId)) {
      return NextResponse.json({ ok: false, message: "고객 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const customer = await db.collection("parties").findOne({
      _id: new ObjectId(customerPartyId),
      partyRoles: "customer",
      status: { $ne: "archived" },
    });
    if (!customer) {
      return NextResponse.json({ ok: false, message: "선택한 고객을 찾을 수 없습니다." }, { status: 400 });
    }
    const facilityId = typeof body.facilityId === "string" ? body.facilityId.trim() : "";
    if (!facilityId) {
      return NextResponse.json({ ok: false, message: "프로젝트를 선택해 주세요." }, { status: 400 });
    }
    if (!ObjectId.isValid(facilityId)) {
      return NextResponse.json({ ok: false, message: "프로젝트 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    if (
      facilityAccessScope.allowedFacilityIds &&
      !facilityAccessScope.allowedFacilityIds.includes(facilityId)
    ) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(facilityId),
      status: { $ne: "archived" },
    });
    if (!project) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트를 찾을 수 없습니다." }, { status: 400 });
    }
    const contractId = typeof body.contractId === "string" ? body.contractId.trim() : "";
    if (!contractId) {
      return NextResponse.json({ ok: false, message: "계약을 선택해 주세요." }, { status: 400 });
    }
    if (!ObjectId.isValid(contractId)) {
      return NextResponse.json({ ok: false, message: "계약 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const contract = await db.collection("contracts").findOne({
      _id: new ObjectId(contractId),
      status: { $in: ["active", "completed"] },
    });
    if (!contract) {
      return NextResponse.json({ ok: false, message: "선택한 계약을 찾을 수 없습니다." }, { status: 400 });
    }
    const projectCustomerPartyId =
      project.customerSnapshot &&
      typeof project.customerSnapshot === "object"
        ? String(
            (project.customerSnapshot as Record<string, unknown>).partyId ?? "",
          )
        : "";
    if (projectCustomerPartyId && projectCustomerPartyId !== customerPartyId) {
      return NextResponse.json(
        { ok: false, message: "선택한 고객이 프로젝트 고객과 일치하지 않습니다." },
        { status: 400 },
      );
    }
    const contractProjectId =
      contract.facilitySnapshot && typeof contract.facilitySnapshot === "object"
        ? String((contract.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    const contractCustomerPartyId =
      contract.customerSnapshot && typeof contract.customerSnapshot === "object"
        ? String((contract.customerSnapshot as Record<string, unknown>).partyId ?? "")
        : "";
    if (contractProjectId && contractProjectId !== facilityId) {
      return NextResponse.json(
        { ok: false, message: "선택한 계약이 프로젝트와 일치하지 않습니다." },
        { status: 400 },
      );
    }
    if (contractCustomerPartyId && contractCustomerPartyId !== customerPartyId) {
      return NextResponse.json(
        { ok: false, message: "선택한 계약이 고객과 일치하지 않습니다." },
        { status: 400 },
      );
    }
    const totalAmount =
      typeof body.totalAmount === "number" ? body.totalAmount : Number(body.totalAmount || 0);
    const contractBillingSummary = await buildContractBillingSummary(db, contract);
    if (totalAmount > contractBillingSummary.remainingBillableAmount) {
      return NextResponse.json(
        {
          ok: false,
          message: `청구 금액이 남은 청구 가능 금액 ${contractBillingSummary.remainingBillableAmount.toLocaleString()}원을 초과했습니다.`,
        },
        { status: 400 },
      );
    }
    const collectionSummary = buildArCollectionSummary({
      totalAmount,
      collectionHistory: [],
      status: "draft",
      collectionSummary: {
        receivedAmount: 0,
        remainingAmount: totalAmount,
        lastReceivedAt: "",
        lastCollectionMethod: "",
      },
    });
    const result = await db.collection("ar_invoices").insertOne({
      ...body,
      invoiceNo: generateArInvoiceNo(),
      totalAmount,
      customerSnapshot: buildPartySnapshot(customer),
      facilitySnapshot: body.facilitySnapshot ?? null,
      contractSnapshot: buildContractSnapshot(contract),
      status: resolveStatus(body.status, "draft"),
      collectionHistory: [],
      collectionSummary: {
        ...collectionSummary,
        receivedAt: "",
      },
      changeHistory: [
        buildArChangeHistoryEntry({
          type: "ar.created",
          title: "AR 등록",
          description: "AR 문서가 생성되었습니다.",
          occurredAt: now,
          profile: auth.profile,
        }),
      ],
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
