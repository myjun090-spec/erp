import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { generateInspectionNo } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("inspection.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    const result = await db.collection("inspections").insertOne({
      ...body,
      inspectionNo: (body.inspectionNo as string) || generateInspectionNo(),
      holdPoint: Boolean(body.holdPoint),
      status: resolveStatus(body.status as string, "pending"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
