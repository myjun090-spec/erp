import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";

export async function GET() {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const [materials, purchaseOrders, inventory] = await Promise.all([
      db.collection("materials").find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).limit(50).toArray(),
      db.collection("purchase_orders").find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).limit(50).toArray(),
      db.collection("inventory_transactions").find({}).sort({ transactionDate: -1 }).limit(50).toArray(),
    ]);
    return NextResponse.json({ ok: true, source: "database", data: {
      materials: materials.map(d => ({ ...d, _id: d._id.toString() })),
      purchaseOrders: purchaseOrders.map(d => ({ ...d, _id: d._id.toString() })),
      inventory: inventory.map(d => ({ ...d, _id: d._id.toString() })),
    }, meta: { total: materials.length + purchaseOrders.length + inventory.length } } satisfies DomainApiSuccessEnvelope<{ materials: unknown[]; purchaseOrders: unknown[]; inventory: unknown[] }>);
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
