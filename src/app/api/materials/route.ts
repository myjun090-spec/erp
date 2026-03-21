import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { generateMaterialCode } from "@/lib/document-numbers";
import { serializeMaterialCertificates } from "@/lib/material-certificates";
import { getMongoDb } from "@/lib/mongodb";
export async function GET() {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const docs = await db.collection("materials").find({ status: { $ne: "archived" } }).sort({ materialCode: 1 }).limit(50).toArray();
    const items = docs.map(d => ({ _id: d._id.toString(), materialCode: d.materialCode, description: d.description, uom: d.uom, specification: d.specification, manufacturerName: d.manufacturerName, category: d.category, status: d.status }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
export async function POST(request: Request) {
  const auth = await requireApiActionPermission("material.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const result = await db.collection("materials").insertOne({
      ...body,
      materialCode: generateMaterialCode(),
      certificates: serializeMaterialCertificates(body.certificates),
      status: resolveStatus(body.status, "active"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
