import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildNextAccountingPeriod,
  normalizeAccountingPeriods,
  normalizeFiscalYearStartMonth,
} from "@/lib/accounting-periods";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("accounting_units").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "회계단위를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, message: "회계단위 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const periodId = typeof body.periodId === "string" ? body.periodId.trim() : "";
    const closeStatus = typeof body.closeStatus === "string" ? body.closeStatus.trim() : "";

    const auth = await requireApiActionPermission(
      closeStatus === "closed"
        ? "accounting-unit.period-close"
        : "accounting-unit.period-open",
    );
    if ("error" in auth) return auth.error;

    if (!periodId) {
      return NextResponse.json(
        { ok: false, message: "대상 회계기간이 선택되지 않았습니다." },
        { status: 400 },
      );
    }

    if (closeStatus !== "open" && closeStatus !== "closed") {
      return NextResponse.json(
        { ok: false, message: "회계기간 상태는 open 또는 closed만 설정할 수 있습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const doc = await db.collection("accounting_units").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json(
        { ok: false, message: "회계단위를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const periods = normalizeAccountingPeriods(doc.periods);
    const periodIndex = periods.findIndex((period) => {
      return String(period.periodId ?? "") === periodId;
    });

    if (periodIndex < 0) {
      return NextResponse.json(
        { ok: false, message: "회계기간을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const nextPeriods = periods.map((period, index) => {
      if (index !== periodIndex) {
        return period;
      }
      return {
        ...period,
        closeStatus,
      };
    });

    const now = new Date().toISOString();
    await db.collection("accounting_units").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          periods: nextPeriods,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: {
          documentVersion: 1,
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("accounting-unit.period-generate");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, message: "회계단위 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const doc = await db.collection("accounting_units").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json(
        { ok: false, message: "회계단위를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const periods = normalizeAccountingPeriods(doc.periods);
    const fiscalYearStartMonth = normalizeFiscalYearStartMonth(doc.fiscalYearStartMonth);

    const latestPeriod = [...periods]
      .sort((left, right) => {
        const leftEnd = String(left.endDate ?? "");
        const rightEnd = String(right.endDate ?? "");
        return rightEnd.localeCompare(leftEnd);
      })[0];

    const nextPeriod = buildNextAccountingPeriod(latestPeriod?.endDate, fiscalYearStartMonth);

    const now = new Date().toISOString();
    const result = await db.collection("accounting_units").updateOne(
      { _id: new ObjectId(id), "periods.periodId": { $ne: nextPeriod.periodId } },
      {
        $push: {
          periods: nextPeriod,
        },
        $set: {
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: {
          documentVersion: 1,
        },
      } as Record<string, unknown>,
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, message: "이미 다음 회계기간이 생성되어 있습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, data: nextPeriod }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
