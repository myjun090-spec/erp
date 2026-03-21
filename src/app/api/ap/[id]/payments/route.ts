import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildApPaymentHistoryItem,
  buildApPaymentSummary,
  normalizeApPaymentHistory,
  resolveEffectiveApStatus,
  serializeApInvoice,
} from "@/lib/ap-payments";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";
import { toNumberValue, toTrimmedString, buildActorSnapshot } from "@/lib/domain-write";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ap.pay");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "AP 식별자가 올바르지 않습니다." }, { status: 400 });
    }

    const db = await getMongoDb();
    const body = await request.json();
    const paymentDate = toTrimmedString(body.paymentDate);
    const paymentMethod = toTrimmedString(body.paymentMethod) || "bank-transfer";
    const paymentNote = toTrimmedString(body.paymentNote);
    const paymentAmount = toNumberValue(body.amount);
    const now = new Date().toISOString();

    if (!paymentDate || paymentAmount <= 0) {
      return NextResponse.json(
        { ok: false, message: "지급일과 지급금액을 확인해 주세요." },
        { status: 400 },
      );
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const doc = await db.collection("ap_invoices").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "AP를 찾을 수 없습니다." }, { status: 404 });
    }

    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !hasProjectAccess(projectId, projectAccessScope.allowedProjectIds)
    ) {
      return NextResponse.json({ ok: false, message: "AP에 접근할 수 없습니다." }, { status: 403 });
    }

    const effectiveStatus = resolveEffectiveApStatus(doc as Record<string, unknown>);
    if (!["approved", "partial-paid", "overdue"].includes(effectiveStatus)) {
      return NextResponse.json(
        { ok: false, message: "승인 또는 부분지급 상태 AP에만 지급 등록이 가능합니다." },
        { status: 400 },
      );
    }

    const paymentHistory = normalizeApPaymentHistory(doc.paymentHistory);
    const paymentSummary = buildApPaymentSummary({
      ...(doc as Record<string, unknown>),
      paymentHistory,
    });
    if (paymentAmount > paymentSummary.remainingAmount) {
      return NextResponse.json(
        {
          ok: false,
          message: `남은 지급 금액 ${paymentSummary.remainingAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        },
        { status: 400 },
      );
    }

    const nextPaymentHistory = [
      ...paymentHistory,
      buildApPaymentHistoryItem({
        paymentDate,
        amount: paymentAmount,
        method: paymentMethod,
        note: paymentNote,
        now,
        profile: auth.profile,
      }),
    ];
    const nextPaymentSummary = buildApPaymentSummary({
      ...(doc as Record<string, unknown>),
      paymentHistory: nextPaymentHistory,
    });
    const nextStatus = nextPaymentSummary.remainingAmount <= 0 ? "paid" : "partial-paid";

    await db.collection("ap_invoices").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: nextStatus,
          paymentHistory: nextPaymentHistory,
          paymentSummary: {
            ...nextPaymentSummary,
            paidAt: nextPaymentSummary.lastPaidAt,
          },
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
      },
    );

    const updatedDoc = await db.collection("ap_invoices").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({
      ok: true,
      data: updatedDoc
        ? serializeApInvoice({ ...updatedDoc, _id: updatedDoc._id.toString() })
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
