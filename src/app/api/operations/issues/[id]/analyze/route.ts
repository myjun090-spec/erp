import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { analyzeIssue } from "@/lib/ai-operations";

export async function POST(
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

    const aiAnalysis = await analyzeIssue(doc.title, doc.description);

    await db.collection("ops_issues").updateOne(
      { _id: new ObjectId(id) },
      { $set: { aiAnalysis, status: "분석중", updatedAt: new Date().toISOString() } },
    );

    return NextResponse.json({ ok: true, data: { aiAnalysis } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
