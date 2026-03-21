import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import { generateManufacturingOrderNo } from "@/lib/document-numbers";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("manufacturing-order.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const result = await db.collection("manufacturing_orders").insertOne({
      orderNo: generateManufacturingOrderNo(),
      ...body,
      status: resolveStatus(body.status, "planned"),
      ...buildCreateMetadata(auth.profile, now),
    });

    // 대상 모듈 상태를 "fabricating"으로 자동 변경
    const moduleId = body.moduleSnapshot?.moduleId;
    if (moduleId && ObjectId.isValid(moduleId)) {
      await db.collection("modules").updateOne(
        { _id: new ObjectId(moduleId), status: "planned" },
        { $set: { status: "fabricating", updatedAt: now } },
      );
    }

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
