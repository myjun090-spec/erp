import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("ops_issues").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ ok: false, message: "이슈를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        _id: doc._id.toString(),
        title: doc.title,
        description: doc.description,
        reporterName: doc.reporterName,
        reporterEmail: doc.reporterEmail,
        location: doc.location,
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
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ops-issue.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const body = await request.json();
    const now = new Date().toISOString();

    const update: Record<string, unknown> = { updatedAt: now };
    if (typeof body.status === "string") update.status = body.status;
    if (typeof body.resolution === "string") update.resolution = body.resolution;
    if (body.status === "완료" || body.status === "종결") update.resolvedAt = now;

    const result = await db.collection("ops_issues").updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ ok: false, message: "이슈를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
