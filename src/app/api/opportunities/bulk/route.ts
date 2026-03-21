import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";

export async function POST(request: Request) {
  try {
    const db = await getMongoDb();
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    const auth = await requireApiActionPermission(
      action === "archive" ? "opportunity.archive" : "opportunity.update",
    );
    if ("error" in auth) return auth.error;
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();

    let updateFields: Record<string, unknown> = {};

    switch (action) {
      case "close-won":
        updateFields = { stage: "closed-won", status: "closed", updatedAt: now };
        break;
      case "close-lost":
        updateFields = { stage: "closed-lost", status: "closed", updatedAt: now };
        break;
      case "advance-stage":
        // advance each OPP to next stage
        const stageOrder = ["lead", "qualified", "proposal", "negotiation", "closed-won"];
        const docs = await db.collection("opportunities").find({ _id: { $in: objectIds } }).toArray();
        let advanced = 0;
        for (const doc of docs) {
          const idx = stageOrder.indexOf(doc.stage);
          if (idx >= 0 && idx < stageOrder.length - 1) {
            await db.collection("opportunities").updateOne(
              { _id: doc._id },
              { $set: { stage: stageOrder[idx + 1], updatedAt: now } },
            );
            advanced++;
          }
        }
        return NextResponse.json({ ok: true, action, affectedCount: advanced, targetIds });
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const result = await db.collection("opportunities").updateMany(
      { _id: { $in: objectIds } },
      { $set: updateFields },
    );

    return NextResponse.json({ ok: true, action, affectedCount: result.modifiedCount, targetIds });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
