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

    const facilities = await db
      .collection("facilities")
      .find(buildFacilityFilter(null, { status: "active" }, facilityAccessScope.allowedFacilityIds))
      .sort({ name: 1 })
      .project({ _id: 1, code: 1, name: 1, status: 1 })
      .toArray();

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        facilities: facilities.map((f) => ({
          _id: f._id.toString(),
          code: String(f.code || ""),
          name: String(f.name || ""),
          status: String(f.status || ""),
        })),
      },
      meta: { total: facilities.length },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
