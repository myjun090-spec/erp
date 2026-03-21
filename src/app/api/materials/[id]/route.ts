import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildActorSnapshot, resolveStatus, toTrimmedString } from "@/lib/domain-write";
import { serializeMaterialCertificates } from "@/lib/material-certificates";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("materials").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "자재를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
        certificates: serializeMaterialCertificates(doc.certificates),
      },
    });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const _id = new ObjectId(id);
    const existing = await db.collection("materials").findOne({ _id });

    if (!existing) {
      return NextResponse.json({ ok: false, message: "자재를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const nextStatus = Object.prototype.hasOwnProperty.call(body, "status")
      ? resolveStatus(body.status, existing.status || "active")
      : resolveStatus(existing.status, "active");
    const auth = await requireApiActionPermission(
      nextStatus === "archived" ? "material.archive" : "material.update",
    );
    if ("error" in auth) return auth.error;
    const now = new Date().toISOString();
    const updateFields = {
      description: Object.prototype.hasOwnProperty.call(body, "description")
        ? toTrimmedString(body.description)
        : toTrimmedString(existing.description),
      specification: Object.prototype.hasOwnProperty.call(body, "specification")
        ? toTrimmedString(body.specification)
        : toTrimmedString(existing.specification),
      uom: Object.prototype.hasOwnProperty.call(body, "uom")
        ? toTrimmedString(body.uom)
        : toTrimmedString(existing.uom),
      manufacturerName: Object.prototype.hasOwnProperty.call(body, "manufacturerName")
        ? toTrimmedString(body.manufacturerName)
        : toTrimmedString(existing.manufacturerName),
      category: Object.prototype.hasOwnProperty.call(body, "category")
        ? toTrimmedString(body.category)
        : toTrimmedString(existing.category),
      certificates: Object.prototype.hasOwnProperty.call(body, "certificates")
        ? serializeMaterialCertificates(body.certificates)
        : serializeMaterialCertificates(existing.certificates),
      status: nextStatus,
      updatedAt: now,
      updatedBy: buildActorSnapshot(auth.profile),
      documentVersion: typeof existing.documentVersion === "number" ? existing.documentVersion + 1 : 2,
    };

    await db.collection("materials").updateOne(
      { _id },
      {
        $set: updateFields,
      },
    );

    return NextResponse.json({
      ok: true,
      data: {
        ...existing,
        ...updateFields,
        _id: existing._id.toString(),
        certificates: serializeMaterialCertificates(updateFields.certificates),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
