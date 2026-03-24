import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { buildFacilityFilter } from "@/lib/facility-scope";

export async function GET() {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const [facilities, accounts, accountingUnits] = await Promise.all([
      db.collection("facilities").find({ status: "active" }).sort({ name: 1 }).limit(100).toArray(),
      db.collection("chart_of_accounts").find({ status: { $ne: "archived" } }).sort({ code: 1 }).limit(500).toArray(),
      db.collection("accounting_units").find(
        buildFacilityFilter(null, { status: { $ne: "archived" } }, facilityAccessScope.allowedFacilityIds)
      ).sort({ code: 1 }).limit(100).toArray(),
    ]);

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        facilities: facilities.map((f) => ({
          _id: f._id.toString(),
          code: String(f.code ?? ""),
          name: String(f.name ?? ""),
        })),
        accounts: accounts.map((a) => ({
          _id: a._id.toString(),
          code: String(a.code ?? ""),
          name: String(a.name ?? ""),
        })),
        accountingUnits: accountingUnits.map((u) => ({
          _id: u._id.toString(),
          code: String(u.code ?? ""),
          name: String(u.name ?? ""),
        })),
      },
      meta: { total: facilities.length + accounts.length + accountingUnits.length },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
