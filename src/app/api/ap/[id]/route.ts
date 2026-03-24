import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { serializeApInvoice } from "@/lib/ap-payments";
import { getMongoDb } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { hasProjectAccess } from "@/lib/facility-scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "AP 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    const db = await getMongoDb();
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const doc = await db.collection("ap_invoices").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "AP를 찾을 수 없습니다." }, { status: 404 });
    const facilityId =
      doc.facilitySnapshot && typeof doc.facilitySnapshot === "object"
        ? String((doc.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    if (
      facilityAccessScope.allowedFacilityIds &&
      !hasProjectAccess(facilityId, facilityAccessScope.allowedFacilityIds)
    ) {
      return NextResponse.json({ ok: false, message: "AP에 접근할 수 없습니다." }, { status: 403 });
    }
    return NextResponse.json({
      ok: true,
      source: "database",
      data: serializeApInvoice({ ...doc, _id: doc._id.toString() }),
    });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
