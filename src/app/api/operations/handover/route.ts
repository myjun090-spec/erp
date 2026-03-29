import { NextResponse } from "next/server";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildCreateMetadata } from "@/lib/domain-write";

export async function GET(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);

    const docs = await db
      .collection("ops_handovers")
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      shiftDate: doc.shiftDate,
      shiftType: doc.shiftType,
      authorName: doc.authorName,
      authorEmail: doc.authorEmail,
      aiSummary: doc.aiSummary ?? null,
      issuesSummary: doc.issuesSummary ?? [],
      pendingItems: doc.pendingItems ?? [],
      manualNotes: doc.manualNotes ?? "",
      vocNotes: doc.vocNotes ?? "",
      specialInstructions: doc.specialInstructions ?? "",
      reminders: doc.reminders ?? [],
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
  const auth = await requireApiActionPermission("ops-handover.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const now = new Date().toISOString();

    const shiftDate = typeof body.shiftDate === "string" ? body.shiftDate : new Date().toISOString().slice(0, 10);
    const shiftType = typeof body.shiftType === "string" ? body.shiftType : "오전";
    const manualNotes = typeof body.manualNotes === "string" ? body.manualNotes : "";
    const vocNotes = typeof body.vocNotes === "string" ? body.vocNotes : "";
    const specialInstructions = typeof body.specialInstructions === "string" ? body.specialInstructions : "";
    const reminders = Array.isArray(body.reminders) ? body.reminders : [];

    const result = await db.collection("ops_handovers").insertOne({
      shiftDate,
      shiftType,
      authorName: auth.profile.displayName,
      authorEmail: auth.profile.email,
      aiSummary: body.aiSummary ?? null,
      issuesSummary: body.issuesSummary ?? [],
      pendingItems: body.pendingItems ?? [],
      manualNotes,
      vocNotes,
      specialInstructions,
      reminders,
      ...buildCreateMetadata(auth.profile, now),
    });

    // Board entry
    await db.collection("ops_board_entries").insertOne({
      type: "handover",
      title: `인수인계: ${shiftDate} ${shiftType}`,
      content: manualNotes || body.aiSummary || "인수인계가 등록되었습니다.",
      authorName: auth.profile.displayName,
      refId: result.insertedId.toString(),
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
