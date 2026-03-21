import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildBudgetLinkSnapshots,
  normalizeBudgetLinkInput,
  resolveBudgetLinkDocuments,
  validateBudgetLinkInput,
} from "@/lib/budget-links";
import { generateJournalEntryNo } from "@/lib/document-numbers";
import { buildCreateMetadata, resolveStatus, stripProtectedCreateFields } from "@/lib/domain-write";
import { normalizeJournalEntryOriginType } from "@/lib/journal-entry-origin";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";

async function resolvePostingAccount(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  accountId: string,
) {
  if (!accountId) {
    return { accountSnapshot: null };
  }

  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(accountId)) {
    return { error: "계정과목 식별자가 올바르지 않습니다." };
  }

  const account = await db.collection("chart_of_accounts").findOne({
    _id: new ObjectId(accountId),
    status: "active",
  });
  if (!account) {
    return { error: "선택한 계정과목을 찾을 수 없습니다." };
  }

  if (account.postingAllowed === false) {
    return { error: "집계계정은 전표에 직접 입력할 수 없습니다." };
  }

  const childCount = await db.collection("chart_of_accounts").countDocuments({
    parentAccountCode: String(account.accountCode ?? "").trim(),
    status: { $ne: "archived" },
  });

  if (childCount > 0) {
    return { error: "하위계정이 있는 계정은 전표에 직접 입력할 수 없습니다." };
  }

  return {
    accountSnapshot: {
      accountCode: String(account.accountCode ?? "").trim(),
      accountName: String(account.accountName ?? "").trim(),
      accountType: String(account.accountType ?? "").trim(),
    },
  };
}

async function resolveAccountingUnitSnapshot(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  accountingUnitId: string,
) {
  if (!accountingUnitId) {
    return { accountingUnitSnapshot: null };
  }

  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(accountingUnitId)) {
    return { error: "회계단위 식별자가 올바르지 않습니다." };
  }

  const accountingUnit = await db.collection("accounting_units").findOne({
    _id: new ObjectId(accountingUnitId),
    status: { $ne: "archived" },
  });

  if (!accountingUnit) {
    return { error: "선택한 회계단위를 찾을 수 없습니다." };
  }

  return {
    accountingUnitSnapshot: {
      accountingUnitId: String(accountingUnit._id),
      code: String(accountingUnit.code ?? "").trim(),
      name: String(accountingUnit.name ?? "").trim(),
      currency: String(accountingUnit.currency ?? "").trim(),
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("journal-entry.create");
  if ("error" in auth) return auth.error;
  try { const db = await getMongoDb(); const body = stripProtectedCreateFields(await request.json()); const now = new Date().toISOString();
    const budgetLinkInput = normalizeBudgetLinkInput(body);
    const validationError = validateBudgetLinkInput(budgetLinkInput);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const resolvedBudgetLink = await resolveBudgetLinkDocuments(
      db,
      budgetLinkInput,
      projectAccessScope.allowedProjectIds,
    );
    if ("error" in resolvedBudgetLink) {
      return NextResponse.json({ ok: false, message: resolvedBudgetLink.error }, { status: 400 });
    }
    const totalDebit =
      typeof body.totalDebit === "number" ? body.totalDebit : Number(body.totalDebit || 0);
    const totalCredit =
      typeof body.totalCredit === "number" ? body.totalCredit : Number(body.totalCredit || 0);
    if (totalDebit <= 0 || totalCredit <= 0) {
      return NextResponse.json(
        { ok: false, message: "차변과 대변은 0보다 커야 합니다." },
        { status: 400 },
      );
    }
    if (totalDebit !== totalCredit) {
      return NextResponse.json(
        { ok: false, message: "차변과 대변 합계가 일치해야 합니다." },
        { status: 400 },
      );
    }
    const enteredAmount = Math.max(totalDebit, totalCredit);
    if (enteredAmount > 0) {
      const duplicateApInvoice = await db.collection("ap_invoices").findOne({
        status: { $in: ["approved", "partial-paid", "paid"] },
        "budgetSnapshot.budgetId": resolvedBudgetLink.budget._id.toString(),
        totalAmount: enteredAmount,
        "journalEntrySnapshot.journalEntryId": { $exists: true, $ne: "" },
      });
      if (duplicateApInvoice) {
        const invoiceNo =
          typeof duplicateApInvoice.invoiceNo === "string"
            ? duplicateApInvoice.invoiceNo
            : "AP";
        const voucherNo =
          duplicateApInvoice.journalEntrySnapshot &&
          typeof duplicateApInvoice.journalEntrySnapshot === "object"
            ? String(
                (duplicateApInvoice.journalEntrySnapshot as Record<string, unknown>).voucherNo ?? "",
              )
            : "";
        return NextResponse.json(
          {
            ok: false,
            message: `${invoiceNo}는 이미 ${voucherNo || "자동 생성 전표"}와 연결되어 있어 같은 금액의 수기 전표를 생성할 수 없습니다.`,
          },
          { status: 400 },
        );
      }
    }
    const resolvedAccountingUnit = await resolveAccountingUnitSnapshot(
      db,
      typeof body.accountingUnitId === "string" ? body.accountingUnitId : "",
    );
    if ("error" in resolvedAccountingUnit) {
      return NextResponse.json({ ok: false, message: resolvedAccountingUnit.error }, { status: 400 });
    }
    const resolvedAccount = await resolvePostingAccount(
      db,
      typeof body.accountId === "string" ? body.accountId : "",
    );
    if ("error" in resolvedAccount) {
      return NextResponse.json({ ok: false, message: resolvedAccount.error }, { status: 400 });
    }
    const voucherNo =
      typeof body.voucherNo === "string" && body.voucherNo.trim()
        ? body.voucherNo.trim()
        : generateJournalEntryNo();
    const journalDate =
      typeof body.journalDate === "string" && body.journalDate.trim()
        ? body.journalDate.trim()
        : now.slice(0, 10);
    const result = await db.collection("journal_entries").insertOne({
      ...body,
      voucherNo,
      journalDate,
      totalDebit,
      totalCredit,
      ...buildBudgetLinkSnapshots(
        resolvedBudgetLink.project,
        resolvedBudgetLink.wbs,
        resolvedBudgetLink.budget,
      ),
      accountingUnitSnapshot: resolvedAccountingUnit.accountingUnitSnapshot,
      accountSnapshot: resolvedAccount.accountSnapshot,
      originType: normalizeJournalEntryOriginType(body.originType),
      status: resolveStatus(body.status, "draft"),
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, data: { _id: result.insertedId.toString() } }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
