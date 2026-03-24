import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("document.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const facilityId = url.searchParams.get("facilityId");
    const filter: Record<string, unknown> = {};
    if (facilityId) filter["facilitySnapshot.facilityId"] = facilityId;
    const docs = await db.collection("document_issues").find(filter).sort({ updatedAt: -1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      documentNo: doc.documentNo,
      templateType: doc.templateType,
      formData: doc.formData,
      previewHtml: doc.previewHtml,
      issuedDate: doc.issuedDate,
      issuerId: doc.issuerId,
      approvalDocId: doc.approvalDocId,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("document-issue.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const counter = await db.collection("counters").findOneAndUpdate(
      { _id: "document_issues" as any }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }
    );
    const seq = String(counter?.seq ?? 1).padStart(4, "0");
    const docNo = `DOC-${now.slice(0,4)}${now.slice(5,7)}-${seq}`;
    const documentNo = body.documentNo ?? null;
    const templateType = body.templateType ?? null;
    const formData = body.formData ?? null;
    const previewHtml = body.previewHtml ?? null;
    const issuedDate = body.issuedDate ?? null;
    const issuerId = body.issuerId ?? null;
    const approvalDocId = body.approvalDocId ?? null;
    const status = body.status ?? null;
    const facilitySnapshot = body.facilitySnapshot ?? null;
    const result = await db.collection("document_issues").insertOne({
      ...{ docNo: docNo },
      documentNo,
      templateType,
      formData,
      previewHtml,
      issuedDate,
      issuerId,
      approvalDocId,
      status,
      facilitySnapshot,
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
