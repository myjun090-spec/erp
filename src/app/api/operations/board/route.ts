import { NextResponse } from "next/server";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const category = url.searchParams.get("category");
    const urgency = url.searchParams.get("urgency");
    const dateFrom = url.searchParams.get("dateFrom");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (urgency) filter.urgency = urgency;
    if (dateFrom) filter.createdAt = { $gte: dateFrom };

    const docs = await db
      .collection("ops_board_entries")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      type: doc.type,
      title: doc.title,
      content: doc.content,
      authorName: doc.authorName,
      category: doc.category ?? undefined,
      urgency: doc.urgency ?? undefined,
      riskLevel: doc.riskLevel ?? undefined,
      refId: doc.refId ?? undefined,
      createdAt: doc.createdAt,
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

    const type = typeof body.type === "string" ? body.type : "announcement";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!title || !content) {
      return NextResponse.json(
        { ok: false, message: "제목과 내용은 필수입니다." },
        { status: 400 },
      );
    }

    const result = await db.collection("ops_board_entries").insertOne({
      type,
      title,
      content,
      authorName: auth.profile.displayName,
      createdAt: now,
    });

    return NextResponse.json(
      { ok: true, data: { _id: result.insertedId.toString() } },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
