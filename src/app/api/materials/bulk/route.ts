import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";

export async function POST(request: Request) {
  try {
    const db = await getMongoDb();
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    const auth = await requireApiActionPermission(
      action === "archive" ? "material.archive" : "material.update",
    );
    if ("error" in auth) return auth.error;
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();
    let updateFields: Record<string, unknown> = {};
    switch (action) {
      case "activate": updateFields = { status: "active", updatedAt: now }; break;
      case "archive": updateFields = { status: "archived", updatedAt: now }; break;
      default: return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
    const result = await db.collection("materials").updateMany({ _id: { $in: objectIds } }, { $set: updateFields });
    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
