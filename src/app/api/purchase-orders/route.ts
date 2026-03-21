import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const docs = await db.collection("purchase_orders").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map(d => ({ _id: d._id.toString(), poNo: d.poNo, projectSnapshot: d.projectSnapshot, vendorSnapshot: d.vendorSnapshot, orderDate: d.orderDate, dueDate: d.dueDate, currency: d.currency, totalAmount: d.totalAmount, lines: d.lines, status: d.status }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
