import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildMonthlyAccountingPeriod,
  normalizeFiscalYearStartMonth,
} from "@/lib/accounting-periods";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const docs = await db.collection("accounting_units").find({ status: { $ne: "archived" } }).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      currency: doc.currency,
      country: doc.country,
      fiscalYearStartMonth: doc.fiscalYearStartMonth,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("accounting-unit.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const code =
      typeof body.code === "string"
        ? body.code.trim()
        : typeof body.unitCode === "string"
          ? body.unitCode.trim()
          : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const currency =
      typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : "KRW";
    const country =
      typeof body.country === "string" && body.country.trim() ? body.country.trim() : "KR";
    const fiscalYearStartMonth = normalizeFiscalYearStartMonth(body.fiscalYearStartMonth);

    if (!code || !name) {
      return NextResponse.json(
        { ok: false, message: "회계단위 코드와 이름은 필수입니다." },
        { status: 400 },
      );
    }

    const duplicatedCode = await db.collection("accounting_units").findOne({
      code,
    });
    if (duplicatedCode) {
      return NextResponse.json(
        { ok: false, message: "이미 사용 중인 회계단위 코드입니다." },
        { status: 409 },
      );
    }

    const initialPeriod = buildMonthlyAccountingPeriod(
      new Date(),
      fiscalYearStartMonth,
      "open",
    );

    const result = await db.collection("accounting_units").insertOne({
      code,
      name,
      currency,
      country,
      fiscalYearStartMonth,
      periods: [initialPeriod],
      status: resolveStatus(body.status, "active"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
