import { NextResponse } from "next/server";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { analyzeIssue } from "@/lib/ai-operations";
import { buildCreateMetadata } from "@/lib/domain-write";

export async function GET(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const urgency = url.searchParams.get("urgency");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

    const filter: Record<string, unknown> = {};
    if (status) filter["status"] = status;
    if (category) filter["aiAnalysis.category"] = category;
    if (urgency) filter["aiAnalysis.urgency"] = urgency;

    const docs = await db
      .collection("ops_issues")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const items = docs.map((doc) => ({
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
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("ops-issue.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const now = new Date().toISOString();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u: unknown) => typeof u === "string") : [];

    if (!title || !description) {
      return NextResponse.json(
        { ok: false, message: "제목과 내용은 필수입니다." },
        { status: 400 },
      );
    }

    // Run AI analysis
    const aiAnalysis = await analyzeIssue(title, description);

    const result = await db.collection("ops_issues").insertOne({
      title,
      description,
      reporterName: auth.profile.displayName,
      reporterEmail: auth.profile.email,
      location,
      imageUrls,
      status: "접수",
      aiAnalysis,
      assignedStaffId: null,
      assignedStaffName: null,
      assignmentReason: null,
      resolution: null,
      resolvedAt: null,
      ...buildCreateMetadata(auth.profile, now),
    });

    // Also add to the board feed
    await db.collection("ops_board_entries").insertOne({
      type: "issue",
      title: `새 이슈: ${title}`,
      content: `${aiAnalysis.category} / ${aiAnalysis.urgency} / 위험도 ${aiAnalysis.riskLevel} - ${aiAnalysis.summary}`,
      authorName: auth.profile.displayName,
      category: aiAnalysis.category,
      urgency: aiAnalysis.urgency,
      riskLevel: aiAnalysis.riskLevel,
      refId: result.insertedId.toString(),
      createdAt: now,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          _id: result.insertedId.toString(),
          aiAnalysis,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
