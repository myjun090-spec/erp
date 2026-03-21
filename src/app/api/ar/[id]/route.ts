import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { serializeArInvoice } from "@/lib/ar-collections";
import { buildContractBillingSummary } from "@/lib/contract-billing";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ ok: false, message: "AR 식별자가 올바르지 않습니다." }, { status: 400 });
    const db = await getMongoDb();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const doc = await db.collection("ar_invoices").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "AR을 찾을 수 없습니다." }, { status: 404 });
    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !hasProjectAccess(projectId, projectAccessScope.allowedProjectIds)
    ) {
      return NextResponse.json({ ok: false, message: "AR에 접근할 수 없습니다." }, { status: 403 });
    }
    const serialized = serializeArInvoice({ ...doc, _id: doc._id.toString() }) as Record<
      string,
      unknown
    >;
    const contractSnapshot =
      serialized.contractSnapshot && typeof serialized.contractSnapshot === "object"
        ? (serialized.contractSnapshot as Record<string, unknown>)
        : null;
    const contractId = String(contractSnapshot?.contractId ?? "");
    let contractBillingSummary = null;
    if (contractId && ObjectId.isValid(contractId)) {
      const contract = await db.collection("contracts").findOne(
        { _id: new ObjectId(contractId) },
        { projection: { _id: 1, contractAmount: 1, amendments: 1 } },
      );
      if (contract) {
        contractBillingSummary = await buildContractBillingSummary(db, contract);
      }
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...serialized,
        contractBillingSummary,
      },
    });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
