import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const today = new Date().toISOString().slice(0, 10);

    const [activeClients, activeCases, runningPrograms, donAgg, todaySchedules, pendingApprovals, unreadCirculations] =
      await Promise.all([
        db.collection("clients").countDocuments({ status: "active" }),
        db.collection("case_plans").countDocuments({ status: "in-progress" }),
        db.collection("programs").countDocuments({ status: "in-progress" }),
        db
          .collection("donations")
          .aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ])
          .toArray(),
        db.collection("schedules").find({ date: today }).sort({ startTime: 1 }).limit(5).toArray(),
        db
          .collection("approval_documents")
          .find({ overallStatus: "submitted" })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray(),
        db
          .collection("circulation_posts")
          .find({ status: "active", unviewedCount: { $gt: 0 } })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray(),
      ]);

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        kpi: {
          activeClients,
          activeCases,
          runningPrograms,
          monthlyDonations: donAgg[0]?.total ?? 0,
        },
        todaySchedules: todaySchedules.map((s) => ({
          _id: s._id.toString(),
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime,
          category: s.category,
        })),
        pendingApprovals: pendingApprovals.map((a) => ({
          _id: a._id.toString(),
          documentNo: a.documentNo,
          title: a.title,
          documentType: a.documentType,
        })),
        unreadCirculations: unreadCirculations.map((c) => ({
          _id: c._id.toString(),
          title: c.title,
          authorName: c.authorSnapshot?.displayName ?? "",
        })),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
