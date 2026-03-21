import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("manufacturing.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const [modules, orders, shipments] = await Promise.all([
      db.collection("modules").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
      db.collection("manufacturing_orders").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
      db.collection("logistics_shipments").find(buildProjectFilter(projectId, {}, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).toArray(),
    ]);
    return NextResponse.json({ ok: true, source: "database", data: {
      modules: modules.map(d => ({ ...d, _id: d._id.toString() })),
      orders: orders.map(d => ({ ...d, _id: d._id.toString() })),
      shipments: shipments.map(d => ({ ...d, _id: d._id.toString() })),
    }, meta: { total: modules.length + orders.length + shipments.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
