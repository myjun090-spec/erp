import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { serializePartyQualifications } from "@/lib/party-qualifications";
export async function GET() {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const docs = await db.collection("parties").find({ partyRoles: "vendor", status: { $ne: "archived" } }).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map(d => ({ _id: d._id.toString(), code: d.code, name: d.name, legalName: d.legalName, taxId: d.taxId, country: d.country, partyRoles: d.partyRoles, qualifications: serializePartyQualifications(d.qualifications), status: d.status }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
