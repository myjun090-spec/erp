import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { generateHandoverBriefing } from "@/lib/ai-operations";

export async function POST(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const shiftDate = typeof body.shiftDate === "string" ? body.shiftDate : new Date().toISOString().slice(0, 10);
    const shiftType = typeof body.shiftType === "string" ? body.shiftType : "오전";

    // Get recent issues (last 24 hours or from the shift date)
    const startOfDay = new Date(shiftDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(shiftDate);
    endOfDay.setHours(23, 59, 59, 999);

    const issueDocs = await db
      .collection("ops_issues")
      .find({
        $or: [
          { createdAt: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
          { updatedAt: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
          { status: { $nin: ["완료", "종결"] } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    const issues = issueDocs.map((doc) => ({
      _id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      reporterName: doc.reporterName ?? "",
      reporterEmail: doc.reporterEmail ?? "",
      location: doc.location ?? "",
      imageUrls: doc.imageUrls ?? [],
      status: doc.status,
      aiAnalysis: doc.aiAnalysis ?? null,
      assignedStaffId: doc.assignedStaffId ?? null,
      assignedStaffName: doc.assignedStaffName ?? null,
      assignmentReason: doc.assignmentReason ?? null,
      resolution: doc.resolution ?? null,
      resolvedAt: doc.resolvedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    const briefing = await generateHandoverBriefing(issues, shiftType, shiftDate);

    return NextResponse.json({
      ok: true,
      data: briefing,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
