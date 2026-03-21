import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("commissioning-package.approve");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();
    let updateFields: Record<string, unknown> = {};

    switch (action) {
      case "start": updateFields = { status: "in-progress", updatedAt: now, updatedBy: buildActorSnapshot(auth.profile) }; break;
      case "mc-complete": updateFields = { status: "mc-complete", updatedAt: now, updatedBy: buildActorSnapshot(auth.profile) }; break;
      case "comm-complete": updateFields = { status: "comm-complete", updatedAt: now, updatedBy: buildActorSnapshot(auth.profile) }; break;
      case "handover": updateFields = { status: "handed-over", handoverDate: now.substring(0, 10), updatedAt: now, updatedBy: buildActorSnapshot(auth.profile) }; break;
      default: return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
    const result = await db.collection("commissioning_packages").updateMany({ _id: { $in: objectIds } }, { $set: updateFields });
    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
