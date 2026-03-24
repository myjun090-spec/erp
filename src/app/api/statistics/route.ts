import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("statistics.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "clients";
    let data: Record<string, number> = {};

    if (type === "clients") {
      const total = await db.collection("clients").countDocuments();
      const active = await db.collection("clients").countDocuments({ status: "active" });
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const newThisMonth = await db.collection("clients").countDocuments({ registrationDate: { $gte: monthStart } });
      const closedThisMonth = await db.collection("case_closures").countDocuments({ createdAt: { $gte: monthStart } });
      data = { totalClients: total, activeClients: active, newThisMonth, closedThisMonth };
    } else if (type === "cases") {
      data = {
        activeCases: await db.collection("case_plans").countDocuments({ status: "in-progress" }),
        completedCases: await db.collection("case_plans").countDocuments({ status: "completed" }),
        serviceLinkages: await db.collection("service_linkages").countDocuments(),
        counselingCount: await db.collection("counseling_records").countDocuments(),
      };
    } else if (type === "programs") {
      data = {
        running: await db.collection("programs").countDocuments({ status: "in-progress" }),
        completed: await db.collection("programs").countDocuments({ status: "completed" }),
        avgParticipation: 0,
        avgSatisfaction: 0,
      };
    } else if (type === "donations") {
      const donorCount = await db.collection("donors").countDocuments({ status: "active" });
      const volunteerCount = await db.collection("volunteers").countDocuments({ status: "active" });
      const donAgg = await db.collection("donations").aggregate([{ $match: { status: "completed" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]).toArray();
      const volAgg = await db.collection("volunteer_hours").aggregate([{ $group: { _id: null, total: { $sum: "$hours" } } }]).toArray();
      data = { monthlyDonation: donAgg[0]?.total ?? 0, donorCount, volunteerCount, totalVolunteerHours: volAgg[0]?.total ?? 0 };
    } else if (type === "finance") {
      const subs = await db.collection("subsidies").find({ status: { $in: ["active", "approved"] } }).toArray();
      const totalGrant = subs.reduce((s, d) => s + (Number(d.grantAmount) || 0), 0);
      const usedAmount = subs.reduce((s, d) => s + (Number(d.usedAmount) || 0), 0);
      data = { totalGrant, usedAmount, executionRate: totalGrant > 0 ? Math.round((usedAmount / totalGrant) * 100) : 0, remainingAmount: totalGrant - usedAmount };
    } else if (type === "facility") {
      data = {
        staffCount: await db.collection("staff").countDocuments({ status: "active" }),
        roomCount: await db.collection("facility_rooms").countDocuments({ status: "active" }),
        supplyCount: await db.collection("facility_supplies").countDocuments(),
        vehicleCount: await db.collection("vehicles").countDocuments({ status: "active" }),
      };
    }

    return NextResponse.json({ ok: true, source: "database", data });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
