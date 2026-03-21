import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    const { action, targetIds } = await request.json() as { action: string; targetIds: string[] };
    const auth = await requireApiActionPermission("shipment.approve");
    if ("error" in auth) return auth.error;
    const db = await getMongoDb();
    const objectIds = targetIds.map(id => new ObjectId(id));
    const now = new Date().toISOString();
    let updateFields: Record<string, unknown> = {};

    switch (action) {
      case "start-transit":
        updateFields = { logisticsStatus: "in-transit", status: "in-transit", updatedAt: now }; break;
      case "complete-delivery":
        updateFields = { logisticsStatus: "delivered", status: "delivered", arrivalDate: now.substring(0, 10), updatedAt: now }; break;
      case "clear-customs":
        updateFields = { customsStatus: "cleared", updatedAt: now }; break;
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const result = await db.collection("logistics_shipments").updateMany({ _id: { $in: objectIds } }, { $set: updateFields });
    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
