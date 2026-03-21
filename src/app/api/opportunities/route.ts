import { NextResponse } from "next/server";
import {
  requireApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, buildCreateMetadata } from "@/lib/domain-write";
import type { DomainApiSuccessEnvelope, DomainApiErrorEnvelope } from "@/lib/domain-api";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("opportunities")
      .find({ status: { $ne: "archived" } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      opportunityNo: doc.opportunityNo,
      name: doc.name,
      customerSnapshot: doc.customerSnapshot,
      opportunityType: doc.opportunityType,
      stage: doc.stage,
      expectedAmount: doc.expectedAmount,
      currency: doc.currency,
      expectedAwardDate: doc.expectedAwardDate,
      ownerUserSnapshot: doc.ownerUserSnapshot,
      status: doc.status,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    } satisfies DomainApiSuccessEnvelope<{ items: typeof items }>);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      } satisfies DomainApiErrorEnvelope,
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("opportunity.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const name = toTrimmedString(body.name);
    const customerPartyId = toTrimmedString(body.customerPartyId);
    const opportunityType = toTrimmedString(body.opportunityType);

    if (!name || !customerPartyId || !opportunityType) {
      return NextResponse.json(
        {
          ok: false,
          message: "기회명, 고객, 기회유형은 필수입니다.",
        } satisfies DomainApiErrorEnvelope,
        { status: 400 },
      );
    }

    let customerSnapshot = null;
    if (customerPartyId) {
      const { ObjectId } = await import("mongodb");
      if (!ObjectId.isValid(customerPartyId)) {
        return NextResponse.json(
          {
            ok: false,
            message: "유효하지 않은 고객 ID입니다.",
          } satisfies DomainApiErrorEnvelope,
          { status: 400 },
        );
      }

      const customer = await db.collection("parties").findOne({ _id: new ObjectId(customerPartyId) });
      if (customer) {
        customerSnapshot = {
          partyId: customer._id.toString(),
          code: customer.code,
          name: customer.name,
          partyRoles: customer.partyRoles,
          taxId: customer.taxId || "",
        };
      }
    }

    if (!customerSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          message: "등록 가능한 고객 정보를 찾지 못했습니다.",
        } satisfies DomainApiErrorEnvelope,
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const actorSnapshot = buildActorSnapshot(auth.profile);
    const result = await db.collection("opportunities").insertOne({
      opportunityNo: body.opportunityNo || `OPP-${Date.now()}`,
      name,
      customerSnapshot,
      opportunityType,
      stage: toTrimmedString(body.stage) || "lead",
      expectedAmount: Number(body.expectedAmount) || 0,
      currency: toTrimmedString(body.currency) || "KRW",
      expectedAwardDate: toTrimmedString(body.expectedAwardDate),
      ownerUserSnapshot: {
        displayName: auth.profile.displayName,
        orgUnitName: auth.profile.orgUnitName,
        email: auth.profile.email,
      },
      proposals: [],
      changeHistory: [
        {
          id: crypto.randomUUID(),
          type: "opportunity.created",
          title: "사업기회 등록",
          description: "초기 사업기회 문서가 생성되었습니다.",
          occurredAt: now,
          actorSnapshot,
        },
      ],
      riskSummary: toTrimmedString(body.riskSummary),
      fileRefs: [],
      status: "active",
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({
      ok: true,
      action: "create",
      affectedCount: 1,
      targetIds: [result.insertedId.toString()],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
