import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildAccountSnapshot, buildAccountingUnitSnapshot } from "@/lib/finance-snapshots";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildActorSnapshot, toTrimmedString } from "@/lib/domain-write";

async function validatePostingAccount(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  accountId: string,
) {
  if (!ObjectId.isValid(accountId)) {
    return { error: "계정과목 식별자가 올바르지 않습니다." } as const;
  }

  const account = await db.collection("chart_of_accounts").findOne({
    _id: new ObjectId(accountId),
    status: "active",
  });
  if (!account) {
    return { error: "선택한 계정과목을 찾을 수 없습니다." } as const;
  }

  if (account.postingAllowed === false) {
    return { error: "집계계정은 전표에 직접 입력할 수 없습니다." } as const;
  }

  const childCount = await db.collection("chart_of_accounts").countDocuments({
    parentAccountCode: toTrimmedString(account.accountCode),
    status: { $ne: "archived" },
  });

  if (childCount > 0) {
    return { error: "하위계정이 있는 계정은 전표에 직접 입력할 수 없습니다." } as const;
  }

  return { account } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("journal_entries").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !projectAccessScope.allowedProjectIds.includes(projectId)
    ) {
      return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, source: "database", data: { ...doc, _id: doc._id.toString() } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("journal-entry.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("journal_entries").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });
    }

    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const projectId =
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String((doc.projectSnapshot as Record<string, unknown>).projectId ?? "")
        : "";
    if (
      projectAccessScope.allowedProjectIds &&
      !projectAccessScope.allowedProjectIds.includes(projectId)
    ) {
      return NextResponse.json({ ok: false, message: "전표를 찾을 수 없습니다." }, { status: 404 });
    }

    const status = toTrimmedString(doc.status);
    if (status !== "draft") {
      return NextResponse.json(
        { ok: false, message: "초안 상태 전표만 수정할 수 있습니다." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const accountingUnitId = toTrimmedString(body.accountingUnitId);
    const accountId = toTrimmedString(body.accountId);

    let accountingUnitSnapshot: Record<string, unknown> | null = null;
    let accountSnapshot: Record<string, unknown> | null = null;

    if (accountingUnitId) {
      if (!ObjectId.isValid(accountingUnitId)) {
        return NextResponse.json(
          { ok: false, message: "회계단위 식별자가 올바르지 않습니다." },
          { status: 400 },
        );
      }

      const accountingUnit = await db.collection("accounting_units").findOne({
        _id: new ObjectId(accountingUnitId),
        status: { $ne: "archived" },
      });
      if (!accountingUnit) {
        return NextResponse.json(
          { ok: false, message: "선택한 회계단위를 찾을 수 없습니다." },
          { status: 400 },
        );
      }
      accountingUnitSnapshot = buildAccountingUnitSnapshot(accountingUnit);
    }

    if (accountId) {
      const resolvedAccount = await validatePostingAccount(db, accountId);
      if ("error" in resolvedAccount) {
        return NextResponse.json(
          { ok: false, message: resolvedAccount.error },
          { status: 400 },
        );
      }
      accountSnapshot = buildAccountSnapshot(resolvedAccount.account);
    }

    const now = new Date().toISOString();
    const result = await db.collection("journal_entries").updateOne(
      { _id: new ObjectId(id), status: "draft" },
      {
        $set: {
          journalDate: toTrimmedString(body.journalDate) || toTrimmedString(doc.journalDate),
          description: toTrimmedString(body.description),
          accountingUnitSnapshot,
          accountSnapshot,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
