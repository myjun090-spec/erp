import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const transitionMap: Record<string, { from: string[]; to: string }> = {
  "start-recruiting": { from: ["planning"], to: "recruiting" },
  "start-program": { from: ["recruiting"], to: "in-progress" },
  complete: { from: ["in-progress"], to: "completed" },
  cancel: { from: ["planning", "recruiting", "in-progress"], to: "cancelled" },
};

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("program.update");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const action = String(body.action || "");
    const targetIds: string[] = Array.isArray(body.targetIds) ? body.targetIds : [];

    const transition = transitionMap[action];
    if (!transition) {
      return NextResponse.json({ ok: false, message: "알 수 없는 액션입니다." }, { status: 400 });
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: false, message: "대상이 없습니다." }, { status: 400 });
    }

    const db = await getMongoDb();
    const now = new Date().toISOString();
    const objectIds = targetIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));

    const result = await db.collection("programs").updateMany(
      {
        _id: { $in: objectIds },
        status: { $in: transition.from },
      },
      {
        $set: {
          status: transition.to,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      affectedCount: result.modifiedCount,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
