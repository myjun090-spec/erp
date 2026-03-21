import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";

export async function POST(request: Request) {
  try {
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    let requiredPermission:
      | "module.update"
      | "manufacturing-order.update" = "module.update";

    switch (action) {
      case "start-testing":
      case "ship":
        requiredPermission = "module.update";
        break;
      case "start-order":
      case "complete-order":
        requiredPermission = "manufacturing-order.update";
        break;
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const auth = await requireApiActionPermission(requiredPermission);
    if ("error" in auth) return auth.error;
    const db = await getMongoDb();
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();
    let collection = "modules";
    let updateFields: Record<string, unknown> = {};

    switch (action) {
      // Module actions
      case "start-testing": updateFields = { status: "testing", updatedAt: now }; collection = "modules"; break;
      case "ship": updateFields = { status: "shipped", updatedAt: now }; collection = "modules"; break;
      // Order actions
      case "start-order": updateFields = { status: "in-progress", updatedAt: now }; collection = "manufacturing_orders"; break;
      case "complete-order": updateFields = { status: "completed", updatedAt: now }; collection = "manufacturing_orders"; break;
      default: return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
    const result = await db.collection(collection).updateMany({ _id: { $in: objectIds } }, { $set: updateFields });
    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
