import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  const auth = await requireApiPermission("admin.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const docs = await db.collection("integration_configs").find().toArray();
    const items = docs.map(d => ({ ...d, _id: d._id.toString() }));
    return NextResponse.json({ ok: true, source: "database", data: { items } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
