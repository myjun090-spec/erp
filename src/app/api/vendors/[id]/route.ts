import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { serializePartyQualifications } from "@/lib/party-qualifications";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const vendor = await db.collection("parties").findOne({ _id: new ObjectId(id), partyRoles: "vendor" });
    if (!vendor) {
      return NextResponse.json({ ok: false, message: "공급업체를 찾을 수 없습니다." }, { status: 404 });
    }
    const purchaseOrders = await db.collection("purchase_orders").find({ "vendorSnapshot.partyId": id }).sort({ orderDate: -1 }).limit(20).toArray();
    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...vendor,
        _id: vendor._id.toString(),
        qualifications: serializePartyQualifications(vendor.qualifications),
        purchaseOrders: purchaseOrders.map((doc) => ({ ...doc, _id: doc._id.toString() })),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
