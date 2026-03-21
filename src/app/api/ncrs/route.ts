import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
export async function POST(request: Request) {
  const auth = await requireApiActionPermission("ncr.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const result = await db.collection("ncrs").insertOne({ ...body, status: resolveStatus(body.status, "open"), ...buildCreateMetadata(auth.profile, now) });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
