import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildArCollectionSummary,
  normalizeArCollectionHistory,
  serializeArInvoice,
} from "@/lib/ar-collections";
import { buildArChangeHistoryEntry, readArChangeHistory } from "@/lib/ar-history";
import { buildActorSnapshot, toTrimmedString } from "@/lib/domain-write";
import { getMongoClient, getMongoDbName } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { hasProjectAccess } from "@/lib/facility-scope";

function resolveNextArStatus(input: { receivedAmount: number; remainingAmount: number }) {
  if (input.remainingAmount <= 0) {
    return "received";
  }
  if (input.receivedAmount > 0) {
    return "partial-received";
  }
  return "issued";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; collectionId: string }> },
) {
  const auth = await requireApiActionPermission("ar.cancel-collection");
  if ("error" in auth) return auth.error;

  try {
    const { id, collectionId } = await params;
    const body = await request.json().catch(() => ({}));
    const cancelReason = toTrimmedString(body.reason);
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "AR 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    if (!collectionId.trim()) {
      return NextResponse.json(
        { ok: false, message: "수금 이력 식별자가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    if (!cancelReason) {
      return NextResponse.json(
        { ok: false, message: "수금 취소 사유를 입력해 주세요." },
        { status: 400 },
      );
    }

    const client = await getMongoClient();
    const db = client.db(getMongoDbName());
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const existingDoc = await db.collection("ar_invoices").findOne({ _id: new ObjectId(id) });
    if (!existingDoc) {
      return NextResponse.json({ ok: false, message: "AR을 찾을 수 없습니다." }, { status: 404 });
    }

    const facilityId =
      existingDoc.facilitySnapshot && typeof existingDoc.facilitySnapshot === "object"
        ? String((existingDoc.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    if (
      facilityAccessScope.allowedFacilityIds &&
      !hasProjectAccess(facilityId, facilityAccessScope.allowedFacilityIds)
    ) {
      return NextResponse.json({ ok: false, message: "AR에 접근할 수 없습니다." }, { status: 403 });
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const doc = await db.collection("ar_invoices").findOne(
          { _id: new ObjectId(id) },
          {
            session,
            projection: {
              _id: 1,
              status: 1,
              dueDate: 1,
              totalAmount: 1,
              collectionHistory: 1,
              changeHistory: 1,
            },
          },
        );
        if (!doc) {
          throw new Error("AR을 찾을 수 없습니다.");
        }

        const collectionHistory = normalizeArCollectionHistory(doc.collectionHistory);
        if (collectionHistory.length === 0) {
          throw new Error("취소할 수금 이력이 없습니다.");
        }

        const latestCollectionItem = collectionHistory[collectionHistory.length - 1];
        if (latestCollectionItem.collectionId !== collectionId) {
          throw new Error("가장 최근 수금 이력만 취소할 수 있습니다.");
        }

        const journalEntryId = String(
          latestCollectionItem.journalEntrySnapshot?.journalEntryId ?? "",
        );
        if (ObjectId.isValid(journalEntryId)) {
          const linkedJournalEntry = await db.collection("journal_entries").findOne(
            { _id: new ObjectId(journalEntryId) },
            {
              session,
              projection: { _id: 1, status: 1, originType: 1, sourceSnapshot: 1 },
            },
          );
          if (linkedJournalEntry) {
            const sourceSnapshot =
              linkedJournalEntry.sourceSnapshot &&
              typeof linkedJournalEntry.sourceSnapshot === "object"
                ? (linkedJournalEntry.sourceSnapshot as Record<string, unknown>)
                : null;
            if (
              String(linkedJournalEntry.originType || "") !== "ar" ||
              String(sourceSnapshot?.eventType || "") !== "collection" ||
              String(sourceSnapshot?.collectionId || "") !== collectionId
            ) {
              throw new Error("AR 수금으로 생성되지 않은 전표가 연결되어 있어 취소할 수 없습니다.");
            }
            if (String(linkedJournalEntry.status || "") !== "draft") {
              throw new Error("연계 전표가 draft 상태일 때만 수금 취소가 가능합니다.");
            }

            await db.collection("journal_entries").deleteOne(
              { _id: linkedJournalEntry._id as ObjectId },
              { session },
            );
          }
        }

        const nextCollectionHistory = collectionHistory.slice(0, -1);
        const nextCollectionSummary = buildArCollectionSummary({
          ...(doc as Record<string, unknown>),
          collectionHistory: nextCollectionHistory,
        });
        const now = new Date().toISOString();

        await db.collection("ar_invoices").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: resolveNextArStatus(nextCollectionSummary),
              collectionHistory: nextCollectionHistory,
              changeHistory: [
                buildArChangeHistoryEntry({
                  type: "ar.collection.canceled",
                  title: "AR 수금 취소",
                  description: `수금액 ₩ ${latestCollectionItem.amount.toLocaleString()}이 취소되었습니다.`,
                  occurredAt: now,
                  profile: auth.profile,
                  reason: cancelReason,
                }),
                ...readArChangeHistory(doc.changeHistory, doc as Record<string, unknown>),
              ],
              collectionSummary: {
                ...nextCollectionSummary,
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
