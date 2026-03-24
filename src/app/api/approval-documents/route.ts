import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("approval.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("approval_documents").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      documentNo: doc.documentNo,
      title: doc.title,
      documentType: doc.documentType,
      content: doc.content,
      drafterId: doc.drafterId,
      drafterSnapshot: doc.drafterSnapshot,
      approvalLine: doc.approvalLine,
      currentStep: doc.currentStep,
      overallStatus: doc.overallStatus,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("approval-doc.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "approval_documents" as unknown as ObjectId }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `APD-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const documentNo = body.documentNo ?? null;
    const title = body.title ?? null;
    const documentType = body.documentType ?? null;
    const content = body.content ?? null;
    const drafterId = body.drafterId ?? null;
    const drafterSnapshot = body.drafterSnapshot ?? null;
    const approvalLine = body.approvalLine ?? null;
    const currentStep = body.currentStep ?? null;
    const overallStatus = body.overallStatus ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("approval_documents").insertOne({
      ...{ docNo: docNo },
      documentNo,
      title,
      documentType,
      content,
      drafterId,
      drafterSnapshot,
      approvalLine,
      currentStep,
      overallStatus,
      facilitySnapshot,
      status: body.status || "active",
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
