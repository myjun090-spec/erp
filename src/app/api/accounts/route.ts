import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toBooleanValue,
  toTrimmedString,
} from "@/lib/domain-write";
import { sanitizeAccountCodeInput } from "@/lib/account-hierarchy";
import { getMongoDb } from "@/lib/mongodb";

const allowedAccountTypes = new Set(["asset", "liability", "equity", "revenue", "expense"]);
const allowedStatuses = new Set(["active", "inactive", "archived"]);

export async function GET() {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const docs = await db.collection("chart_of_accounts").find({ status: { $ne: "archived" } }).sort({ accountCode: 1 }).limit(200).toArray();
    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      accountCode: doc.accountCode,
      accountName: doc.accountName,
      accountType: doc.accountType,
      parentAccountCode: doc.parentAccountCode,
      postingAllowed: doc.postingAllowed,
      status: doc.status,
    }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("account.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();
    const accountCode = sanitizeAccountCodeInput(toTrimmedString(body.accountCode));
    const accountName = toTrimmedString(body.accountName || body.name);
    const accountType = toTrimmedString(body.accountType);
    const parentAccountCode = sanitizeAccountCodeInput(toTrimmedString(body.parentAccountCode)) || null;
    const description = toTrimmedString(body.description);
    const postingAllowed = toBooleanValue(body.postingAllowed, true);
    const status = resolveStatus(body.status, "active");

    if (!accountCode || !accountName || !accountType) {
      return NextResponse.json(
        { ok: false, message: "계정코드, 계정명, 계정유형은 필수입니다." },
        { status: 400 },
      );
    }

    if (!allowedAccountTypes.has(accountType)) {
      return NextResponse.json(
        { ok: false, message: "계정유형이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { ok: false, message: "계정 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (parentAccountCode && parentAccountCode === accountCode) {
      return NextResponse.json(
        { ok: false, message: "자기 자신을 상위계정으로 지정할 수 없습니다." },
        { status: 400 },
      );
    }

    if (parentAccountCode) {
      const parentAccount = await db.collection("chart_of_accounts").findOne({
        accountCode: parentAccountCode,
      });

      if (!parentAccount) {
        return NextResponse.json(
          { ok: false, message: "상위계정을 찾을 수 없습니다." },
          { status: 400 },
        );
      }

      if (parentAccount.status !== "active") {
        return NextResponse.json(
          { ok: false, message: "활성 상태의 상위계정만 선택할 수 있습니다." },
          { status: 400 },
        );
      }
    }

    const duplicate = await db.collection("chart_of_accounts").findOne({
      accountCode,
      status: { $ne: "archived" },
    });

    if (duplicate) {
      return NextResponse.json(
        { ok: false, message: "이미 사용 중인 계정코드입니다." },
        { status: 409 },
      );
    }

    const result = await db.collection("chart_of_accounts").insertOne({
      accountCode,
      accountName,
      accountType,
      parentAccountCode,
      postingAllowed,
      description,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    if (parentAccountCode) {
      await db.collection("chart_of_accounts").updateOne(
        { accountCode: parentAccountCode, postingAllowed: { $ne: false } },
        {
          $set: {
            postingAllowed: false,
            updatedAt: now,
            updatedBy: buildActorSnapshot(auth.profile),
          },
          $inc: {
            documentVersion: 1,
          },
        },
      );
    }

    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
