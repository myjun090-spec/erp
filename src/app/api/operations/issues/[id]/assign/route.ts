import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ops-issue.assign");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const body = await request.json();

    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const staffName = typeof body.staffName === "string" ? body.staffName.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!staffId || !staffName) {
      return NextResponse.json(
        { ok: false, message: "배정할 직원 정보가 필요합니다." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const result = await db.collection("ops_issues").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          assignmentReason: reason,
          status: "배정됨",
          updatedAt: now,
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, message: "이슈를 찾을 수 없습니다." }, { status: 404 });
    }

    // Increase staff's current load
    try {
      await db.collection("ops_staff").updateOne(
        { _id: new ObjectId(staffId) },
        { $inc: { currentLoad: 1 } },
      );
    } catch {
      // Non-critical, ignore
    }

    // Board entry
    await db.collection("ops_board_entries").insertOne({
      type: "notification",
      title: `이슈 배정: ${staffName}`,
      content: reason || `이슈(${id})가 ${staffName}에게 배정되었습니다.`,
      authorName: auth.profile.displayName,
      refId: id,
      createdAt: now,
    });

    return NextResponse.json({ ok: true, data: { _id: id, assignedStaffName: staffName } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
