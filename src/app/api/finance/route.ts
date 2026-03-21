import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { serializeApInvoice } from "@/lib/ap-payments";
import { serializeArInvoice } from "@/lib/ar-collections";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const [accounts, units, journals, ap, ar, assets] = await Promise.all([
      db.collection("chart_of_accounts").find({}).sort({ accountCode: 1 }).toArray(),
      db.collection("accounting_units").find({}).toArray(),
      db.collection("journal_entries").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ journalDate: -1 }).toArray(),
      db.collection("ap_invoices").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ invoiceDate: -1 }).toArray(),
      db.collection("ar_invoices").find(buildProjectFilter(projectId, { status: { $ne: "archived" } }, projectAccessScope.allowedProjectIds)).sort({ invoiceDate: -1 }).toArray(),
      db.collection("fixed_assets").find(buildProjectFilter(projectId, {}, projectAccessScope.allowedProjectIds)).sort({ assetNo: 1 }).toArray(),
    ]);
    return NextResponse.json({ ok: true, source: "database", data: {
      accounts: accounts.map(d => ({ ...d, _id: d._id.toString() })),
      accountingUnits: units.map(d => ({ ...d, _id: d._id.toString() })),
      journalEntries: journals.map(d => ({ ...d, _id: d._id.toString() })),
      apInvoices: ap.map(d => serializeApInvoice({ ...d, _id: d._id.toString() })),
      arInvoices: ar.map(d => serializeArInvoice({ ...d, _id: d._id.toString() })),
      fixedAssets: assets.map(d => ({ ...d, _id: d._id.toString() })),
    }, meta: { total: accounts.length + units.length + journals.length + ap.length + ar.length + assets.length } });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
