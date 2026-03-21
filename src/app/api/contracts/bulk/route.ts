import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import type { BulkActionRequest } from "@/lib/domain-api";
import { getMongoDb } from "@/lib/mongodb";

type BulkActionMeta = {
  status: string;
  title: string;
  description: string;
  eventType: string;
};

export async function POST(request: Request) {
  try {
    const body: BulkActionRequest = await request.json();
    const { action, targetIds } = body;
    const auth = await requireApiActionPermission(
      action === "archive" ? "contract.archive" : "contract.approve",
    );
    if ("error" in auth) return auth.error;
    const db = await getMongoDb();
    const objectIds = targetIds.map((id) => new ObjectId(id));
    const now = new Date().toISOString();
    const actorSnapshot = buildActorSnapshot(auth.profile);

    let actionMeta: BulkActionMeta | null = null;

    switch (action) {
      case "request-review":
        actionMeta = {
          status: "review",
          title: "계약 상태 변경",
          description: "계약 상태가 검토로 변경되었습니다.",
          eventType: "contract.status.updated",
        };
        break;
      case "activate":
        actionMeta = {
          status: "active",
          title: "계약 상태 변경",
          description: "계약 상태가 활성으로 변경되었습니다.",
          eventType: "contract.status.updated",
        };
        break;
      case "archive":
        actionMeta = {
          status: "archived",
          title: "계약 보관",
          description: "계약이 목록에서 제외되도록 보관 처리되었습니다.",
          eventType: "contract.archived",
        };
        break;
      default:
        return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const docs = await db
      .collection("contracts")
      .find({ _id: { $in: objectIds } }, { projection: { _id: 1, changeHistory: 1 } })
      .toArray();

    const results = await Promise.all(
      docs.map((doc) => {
        const currentHistory = Array.isArray(doc.changeHistory) ? doc.changeHistory : [];
        const nextHistoryEntry = {
          id: crypto.randomUUID(),
          type: actionMeta.eventType,
          title: actionMeta.title,
          description: actionMeta.description,
          occurredAt: now,
          actorSnapshot,
        };

        return db.collection("contracts").updateOne(
          { _id: doc._id },
          {
            $set: {
              status: actionMeta.status,
              updatedAt: now,
              updatedBy: actorSnapshot,
              changeHistory: [nextHistoryEntry, ...currentHistory],
            },
            $inc: { documentVersion: 1 },
          },
        );
      }),
    );

    const affectedCount = results.reduce((sum, result) => sum + result.modifiedCount, 0);

    return NextResponse.json({ ok: true, action, affectedCount, targetIds });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
