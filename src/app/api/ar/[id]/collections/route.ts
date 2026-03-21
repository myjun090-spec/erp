import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildArCollectionJournalEntryDocument,
  buildArJournalEntrySnapshot,
} from "@/lib/ar-journal-entries";
import {
  buildArCollectionHistoryItem,
  buildArCollectionSummary,
  normalizeArCollectionHistory,
  resolveEffectiveArStatus,
  serializeArInvoice,
} from "@/lib/ar-collections";
import { buildArChangeHistoryEntry, readArChangeHistory } from "@/lib/ar-history";
import { canCollectAr } from "@/lib/ar-status";
import { buildActorSnapshot, toNumberValue, toTrimmedString } from "@/lib/domain-write";
import { generateJournalEntryNo } from "@/lib/document-numbers";
import { getMongoClient, getMongoDbName } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiActionPermission("ar.collect");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "AR 식별자가 올바르지 않습니다." }, { status: 400 });
    }

    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    const body = await request.json();
    const collectionDate = toTrimmedString(body.collectionDate);
    const collectionMethod = toTrimmedString(body.collectionMethod) || "bank-transfer";
    const collectionNote = toTrimmedString(body.collectionNote);
    const collectionAmount = toNumberValue(body.amount);
    const now = new Date().toISOString();

    if (!collectionDate || collectionAmount <= 0) {
      return NextResponse.json(
        { ok: false, message: "수금일과 수금금액을 확인해 주세요." },
        { status: 400 },
      );
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const doc = await db.collection("ar_invoices").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "AR을 찾을 수 없습니다." }, { status: 404 });
    }

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

    const effectiveStatus = resolveEffectiveArStatus(doc as Record<string, unknown>);
    if (!canCollectAr(effectiveStatus)) {
      return NextResponse.json(
        { ok: false, message: "발행 또는 부분수금 상태 AR에만 수금 등록이 가능합니다." },
        { status: 400 },
      );
    }

    const collectionHistory = normalizeArCollectionHistory(doc.collectionHistory);
    const collectionSummary = buildArCollectionSummary({
      ...(doc as Record<string, unknown>),
      collectionHistory,
    });
    if (collectionAmount > collectionSummary.remainingAmount) {
      return NextResponse.json(
        {
          ok: false,
          message: `남은 수금 가능 금액 ${collectionSummary.remainingAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        },
        { status: 400 },
      );
    }

    const nextCollectionHistory = [
      ...collectionHistory,
      buildArCollectionHistoryItem({
        collectionDate,
        amount: collectionAmount,
        method: collectionMethod,
        note: collectionNote,
        now,
        profile: auth.profile,
      }),
    ];
    const nextCollectionSummary = buildArCollectionSummary({
      ...(doc as Record<string, unknown>),
      collectionHistory: nextCollectionHistory,
    });
    const nextStatus = nextCollectionSummary.remainingAmount <= 0 ? "received" : "partial-received";

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const voucherNo = generateJournalEntryNo();
        const journalEntryDoc = buildArCollectionJournalEntryDocument({
          arInvoice: doc,
          collectionId: nextCollectionHistory[nextCollectionHistory.length - 1].collectionId,
          collectionDate,
          amount: collectionAmount,
          voucherNo,
          now,
          profile: auth.profile,
        });
        const insertResult = await db.collection("journal_entries").insertOne(journalEntryDoc, {
          session,
        });

        nextCollectionHistory[nextCollectionHistory.length - 1].journalEntrySnapshot =
          buildArJournalEntrySnapshot(insertResult.insertedId.toString(), voucherNo);

        await db.collection("ar_invoices").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: nextStatus,
              collectionHistory: nextCollectionHistory,
              changeHistory: [
                buildArChangeHistoryEntry({
                  type: "ar.collection.created",
                  title: "AR 수금 등록",
                  description: `수금액 ₩ ${collectionAmount.toLocaleString()}이 등록되었습니다.`,
                  occurredAt: now,
                  profile: auth.profile,
                }),
                ...readArChangeHistory(doc.changeHistory, doc as Record<string, unknown>),
              ],
              collectionSummary: {
                ...buildArCollectionSummary({
                  ...(doc as Record<string, unknown>),
                  collectionHistory: nextCollectionHistory,
                }),
                receivedAt: nextCollectionSummary.lastReceivedAt,
              },
              updatedAt: now,
              updatedBy: buildActorSnapshot(auth.profile),
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedDoc = await db.collection("ar_invoices").findOne({ _id: new ObjectId(id) });
    return NextResponse.json({
      ok: true,
      data: updatedDoc
        ? serializeArInvoice({ ...updatedDoc, _id: updatedDoc._id.toString() })
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
