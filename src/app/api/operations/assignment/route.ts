import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { suggestStaffAssignment } from "@/lib/ai-operations";

export async function POST(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = await request.json();
    const issueId = typeof body.issueId === "string" ? body.issueId.trim() : "";

    if (!issueId) {
      return NextResponse.json(
        { ok: false, message: "이슈 ID가 필요합니다." },
        { status: 400 },
      );
    }

    const issue = await db.collection("ops_issues").findOne({ _id: new ObjectId(issueId) });
    if (!issue) {
      return NextResponse.json(
        { ok: false, message: "이슈를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const staffDocs = await db
      .collection("ops_staff")
      .find({ isActive: true })
      .toArray();

    const staffList = staffDocs.map((doc) => ({
      _id: doc._id.toString(),
      name: doc.name,
      email: doc.email ?? "",
      role: doc.role ?? "",
      department: doc.department ?? "",
      skills: doc.skills ?? [],
      schedule: doc.schedule ?? [],
      phone: doc.phone ?? "",
      isActive: doc.isActive ?? true,
      currentLoad: doc.currentLoad ?? 0,
      createdAt: doc.createdAt ?? "",
      updatedAt: doc.updatedAt ?? "",
    }));

    const suggestions = await suggestStaffAssignment(
      {
        title: issue.title,
        description: issue.description,
        aiAnalysis: issue.aiAnalysis ?? null,
      },
      staffList,
    );

    return NextResponse.json({
      ok: true,
      data: { suggestions },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
