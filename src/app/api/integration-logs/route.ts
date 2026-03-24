import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireApiPermission("admin.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const url = new URL(request.url);
    const systemCode = url.searchParams.get("systemCode");
    const filter: Record<string, unknown> = {};
    if (systemCode) filter.systemCode = systemCode;
    const docs = await db.collection("integration_logs").find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    const items = docs.map(d => ({ ...d, _id: d._id.toString() }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
