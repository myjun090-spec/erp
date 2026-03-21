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
      | "itp.update"
      | "inspection.update"
      | "ncr.update" = "itp.update";

    switch (action) {
      case "submit-review":
      case "approve-itp":
      case "revoke-itp":
        requiredPermission = "itp.update";
        break;
      case "verify":
        requiredPermission = "inspection.update";
        break;
      case "close-ncr":
        requiredPermission = "ncr.update";
        break;
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const auth = await requireApiActionPermission(requiredPermission);
    if ("error" in auth) return auth.error;
    const db = await getMongoDb();
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();
    let collection = "itps";
    let updateFields: Record<string, unknown> = {};

    switch (action) {
      // ITP actions
      case "submit-review": updateFields = { approvalStatus: "review", updatedAt: now }; collection = "itps"; break;
      case "approve-itp": updateFields = { approvalStatus: "approved", updatedAt: now }; collection = "itps"; break;
      case "revoke-itp": updateFields = { approvalStatus: "draft", updatedAt: now }; collection = "itps"; break;
      // Inspection actions
      case "verify": updateFields = { status: "verified", updatedAt: now }; collection = "inspections"; break;
      // NCR actions
      case "close-ncr": updateFields = { status: "closed", updatedAt: now }; collection = "ncrs"; break;
      default: return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
    const result = await db.collection(collection).updateMany({ _id: { $in: objectIds } }, { $set: updateFields });
    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
