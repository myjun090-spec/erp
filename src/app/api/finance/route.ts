import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { serializeApInvoice } from "@/lib/ap-payments";
import { serializeArInvoice } from "@/lib/ar-collections";
import { getMongoDb } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { buildFacilityFilter, getFacilityIdFromRequest } from "@/lib/facility-scope";

export async function GET(request: Request) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const facilityId = getFacilityIdFromRequest(request);
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const [accounts, units, journals, ap, ar, assets] = await Promise.all([
      db.collection("chart_of_accounts").find({}).sort({ accountCode: 1 }).toArray(),
      db.collection("accounting_units").find({}).toArray(),
      db.collection("journal_entries").find(buildFacilityFilter(facilityId, { status: { $ne: "archived" } }, facilityAccessScope.allowedFacilityIds)).sort({ journalDate: -1 }).toArray(),
      db.collection("ap_invoices").find(buildFacilityFilter(facilityId, { status: { $ne: "archived" } }, facilityAccessScope.allowedFacilityIds)).sort({ invoiceDate: -1 }).toArray(),
      db.collection("ar_invoices").find(buildFacilityFilter(facilityId, { status: { $ne: "archived" } }, facilityAccessScope.allowedFacilityIds)).sort({ invoiceDate: -1 }).toArray(),
      db.collection("fixed_assets").find(buildFacilityFilter(facilityId, {}, facilityAccessScope.allowedFacilityIds)).sort({ assetNo: 1 }).toArray(),
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
