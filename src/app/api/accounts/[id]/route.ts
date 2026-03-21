import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  requireAnyApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { buildActorSnapshot, resolveStatus, toBooleanValue, toTrimmedString } from "@/lib/domain-write";
import { sanitizeAccountCodeInput } from "@/lib/account-hierarchy";
import { getMongoDb } from "@/lib/mongodb";
import { hasPermission } from "@/lib/navigation";

const allowedStatuses = new Set(["active", "inactive", "archived"]);

type AccountHierarchyNode = {
  accountCode: string;
  parentAccountCode?: string | null;
  status?: string;
};

function createsAccountCycle(
  currentAccountCode: string,
  nextParentAccountCode: string,
  accounts: AccountHierarchyNode[],
) {
  const childrenByParent = new Map<string, string[]>();

  for (const account of accounts) {
    if (!account.parentAccountCode || account.status === "archived") {
      continue;
    }

    const siblings = childrenByParent.get(account.parentAccountCode) ?? [];
    siblings.push(account.accountCode);
    childrenByParent.set(account.parentAccountCode, siblings);
  }

  const stack = [...(childrenByParent.get(currentAccountCode) ?? [])];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const accountCode = stack.pop();
    if (!accountCode || visited.has(accountCode)) {
      continue;
    }

    if (accountCode === nextParentAccountCode) {
      return true;
    }

    visited.add(accountCode);
    stack.push(...(childrenByParent.get(accountCode) ?? []));
  }

  return false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "계정과목을 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("chart_of_accounts").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "계정과목을 찾을 수 없습니다." }, { status: 404 });
    }

    const [journalEntryCount, childCount] = await Promise.all([
      db.collection("journal_entries").countDocuments({
        "accountSnapshot.accountCode": doc.accountCode,
      }),
      db.collection("chart_of_accounts").countDocuments({
        parentAccountCode: doc.accountCode,
        status: { $ne: "archived" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
        usageSummary: {
          journalEntryCount,
          childCount,
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAnyApiActionPermission(["account.update", "account.archive"]);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "계정과목을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("chart_of_accounts").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "계정과목을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const accountName = toTrimmedString(body.accountName || doc.accountName);
    const parentAccountCode =
      sanitizeAccountCodeInput(toTrimmedString(body.parentAccountCode)) || null;
    const description = toTrimmedString(body.description);
    const postingAllowed = toBooleanValue(body.postingAllowed, Boolean(doc.postingAllowed));
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "active");
    const requiredPermission = status === "archived" ? "account.archive" : "account.update";

    if (!hasPermission(auth.profile.permissions, requiredPermission)) {
      return NextResponse.json(
        { ok: false, message: "해당 API 접근 권한이 없습니다." },
        { status: 403 },
      );
    }

    if (!accountName) {
      return NextResponse.json(
        { ok: false, message: "계정명은 필수입니다." },
        { status: 400 },
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { ok: false, message: "계정 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (parentAccountCode && parentAccountCode === sanitizeAccountCodeInput(toTrimmedString(doc.accountCode))) {
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

      const hierarchyDocs = (await db
        .collection("chart_of_accounts")
        .find({}, { projection: { accountCode: 1, parentAccountCode: 1, status: 1 } })
        .toArray()).map((account) => ({
          accountCode: sanitizeAccountCodeInput(toTrimmedString(account.accountCode)),
          parentAccountCode: sanitizeAccountCodeInput(toTrimmedString(account.parentAccountCode)) || null,
          status: toTrimmedString(account.status),
        })) satisfies AccountHierarchyNode[];

      if (
        createsAccountCycle(
          sanitizeAccountCodeInput(toTrimmedString(doc.accountCode)),
          parentAccountCode,
          hierarchyDocs,
        )
      ) {
        return NextResponse.json(
          { ok: false, message: "자식 계정을 상위계정으로 지정할 수 없습니다." },
          { status: 400 },
        );
      }
    }

    const nonArchivedChildCount = await db.collection("chart_of_accounts").countDocuments({
      parentAccountCode: doc.accountCode,
      status: { $ne: "archived" },
    });

    if (postingAllowed && nonArchivedChildCount > 0) {
      return NextResponse.json(
        { ok: false, message: "하위계정이 있는 계정은 전기가능으로 설정할 수 없습니다." },
        { status: 400 },
      );
    }

    if (status === "inactive") {
      const activeChildCount = await db.collection("chart_of_accounts").countDocuments({
        parentAccountCode: doc.accountCode,
        status: "active",
      });

      if (activeChildCount > 0) {
        return NextResponse.json(
          { ok: false, message: "활성 하위계정이 남아 있는 계정은 비활성화할 수 없습니다." },
          { status: 400 },
        );
      }
    }

    if (status === "archived") {
      if (nonArchivedChildCount > 0) {
        return NextResponse.json(
          { ok: false, message: "하위계정이 남아 있는 계정은 보관할 수 없습니다." },
          { status: 400 },
        );
      }
    }

    const now = new Date().toISOString();
    await db.collection("chart_of_accounts").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          accountName,
          parentAccountCode,
          postingAllowed,
          description,
          status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: {
          documentVersion: 1,
        },
      },
    );

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

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
