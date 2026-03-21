import { NextResponse } from "next/server";
import {
  requireApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { generateContractNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { getEffectiveContractAmount } from "@/lib/contract-amendments";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  toNumberValue,
  toTrimmedString,
} from "@/lib/domain-write";
import type { DomainApiSuccessEnvelope, DomainApiErrorEnvelope } from "@/lib/domain-api";

export async function GET() {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("contracts")
      .find({ status: { $ne: "archived" } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      contractNo: doc.contractNo,
      contractType: doc.contractType,
      title: doc.title,
      projectSnapshot: doc.projectSnapshot,
      customerSnapshot: doc.customerSnapshot,
      partnerSnapshots: doc.partnerSnapshots || [],
      startDate: doc.startDate,
      endDate: doc.endDate,
      contractAmount: getEffectiveContractAmount(doc.contractAmount, doc.amendments),
      currency: doc.currency,
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
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" } satisfies DomainApiErrorEnvelope,
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("contract.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const { ObjectId } = await import("mongodb");
    const title = toTrimmedString(body.title);
    const contractType = toTrimmedString(body.contractType);

    if (!title || !contractType) {
      return NextResponse.json(
        { ok: false, message: "계약명과 계약유형은 필수입니다." } satisfies DomainApiErrorEnvelope,
        { status: 400 },
      );
    }

    let customerSnapshot = null;
    if (body.customerPartyId) {
      const customer = await db.collection("parties").findOne({ _id: new ObjectId(body.customerPartyId) });
      if (customer) {
        customerSnapshot = { partyId: customer._id.toString(), code: customer.code, name: customer.name, partyRoles: customer.partyRoles, taxId: customer.taxId || "" };
      }
    }

    let projectSnapshot = null;
    if (body.projectId) {
      const project = await db.collection("projects").findOne({ _id: new ObjectId(body.projectId) });
      if (project) {
        projectSnapshot = { projectId: project._id.toString(), code: project.code, name: project.name, projectType: project.projectType };
      }
    }

    const now = new Date().toISOString();
    const actorSnapshot = buildActorSnapshot(auth.profile);
    const result = await db.collection("contracts").insertOne({
      contractNo: toTrimmedString(body.contractNo) || generateContractNo(),
      contractType,
      title,
      projectSnapshot,
      customerSnapshot,
      partnerSnapshots: [],
      startDate: toTrimmedString(body.startDate),
      endDate: toTrimmedString(body.endDate),
      contractAmount: toNumberValue(body.contractAmount),
      currency: toTrimmedString(body.currency) || "KRW",
      amendments: [],
      changeHistory: [
        {
          id: crypto.randomUUID(),
          type: "contract.created",
          title: "계약 등록",
          description: "초기 계약 문서가 생성되었습니다.",
          occurredAt: now,
          actorSnapshot,
        },
      ],
      fileRefs: [],
      status: "draft",
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
