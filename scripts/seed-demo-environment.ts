import { loadEnvConfig } from "@next/env";
import { ObjectId } from "mongodb";
import { getMongoClient, getMongoDb } from "../src/lib/mongodb";
import { buildCreateMetadata, buildActorSnapshot } from "../src/lib/domain-write";
import { buildProjectSnapshot, buildSiteSummary } from "../src/lib/project-sites";
import { buildSiteSnapshot, buildUnitSummary } from "../src/lib/project-units";
import { buildSystemSnapshot, buildSystemSummary } from "../src/lib/project-systems";
import { buildWbsSnapshot } from "../src/lib/project-wbs";
import {
  buildEmptyExecutionBudgetUsageSummary,
} from "../src/lib/execution-budgets";
import { buildBudgetSnapshot } from "../src/lib/budget-links";
import { buildMaterialSnapshot } from "../src/lib/material-snapshot";
import { buildPartySnapshot } from "../src/lib/party-snapshot";
import {
  buildInventoryTransactionDocument,
  buildReferenceSnapshot,
} from "../src/lib/inventory-transactions";
import { buildApPaymentSummary } from "../src/lib/ap-payments";
import { buildArCollectionSummary } from "../src/lib/ar-collections";
import { buildFixedAssetDepreciationState } from "../src/lib/fixed-assets";
import { buildMonthlyAccountingPeriod } from "../src/lib/accounting-periods";
import { buildArJournalEntrySnapshot } from "../src/lib/ar-journal-entries";
import { recalculateExecutionBudgetUsage } from "../src/lib/execution-budget-usage";
import { type AppRole } from "../src/lib/navigation";
import { allPermissionCatalog, expandPermissionCodes } from "../src/lib/permission-catalog";

loadEnvConfig(process.cwd());

const SEED_TAG = "erp-demo-environment-v20260319";
const BASE_TIME = new Date("2026-03-19T00:00:00.000Z");
const seedProfile = {
  displayName: "ERP Demo Seeder",
  orgUnitName: "Platform Seed",
  email: "seed.bot@local.erp",
};

const shouldDryRun = process.argv.includes("--dry-run");
const shouldReset = !process.argv.includes("--no-reset");

const collectionNames = [
  "approvalHistory",
  "approvalTasks",
  "savedViews",
  "notifications",
  "workspacePosts",
  "regulatory_actions",
  "commissioning_packages",
  "fixed_assets",
  "journal_entries",
  "ar_invoices",
  "ap_invoices",
  "chart_of_accounts",
  "accounting_units",
  "hse_incidents",
  "ncrs",
  "inspections",
  "itps",
  "logistics_shipments",
  "manufacturing_orders",
  "modules",
  "inventory_transactions",
  "purchase_orders",
  "materials",
  "progress_records",
  "execution_budgets",
  "wbs_items",
  "systems",
  "units",
  "sites",
  "projects",
  "contracts",
  "opportunities",
  "parties",
  "auditLogs",
  "users",
  "policies",
  "roles",
  "orgUnits",
];

function addDays(days: number, hour = 9, minute = 0) {
  const next = new Date(BASE_TIME);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

function isoDate(days: number) {
  return addDays(days).toISOString().slice(0, 10);
}

function isoTimestamp(days: number, hour = 9, minute = 0) {
  return addDays(days, hour, minute).toISOString();
}

function makeDoc<T extends Record<string, unknown>>(
  doc: T,
  days = 0,
  hour = 9,
): T & { seedTag: string } & ReturnType<typeof buildCreateMetadata> {
  const now = isoTimestamp(days, hour);
  return {
    ...doc,
    seedTag: SEED_TAG,
    ...buildCreateMetadata(seedProfile, now),
  } as T & { seedTag: string } & ReturnType<typeof buildCreateMetadata>;
}

function makeActor(displayName: string, orgUnitName: string, email: string, employeeNo = "") {
  return {
    userId: email,
    employeeNo,
    displayName,
    orgUnitName,
  };
}

function createChangeEntry(input: {
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  actor: ReturnType<typeof makeActor>;
  reason?: string;
}) {
  return {
    id: new ObjectId().toString(),
    type: input.type,
    title: input.title,
    description: input.description,
    occurredAt: input.occurredAt,
    reason: input.reason ?? "",
    actorSnapshot: input.actor,
  };
}

function buildContractSnapshot(contract: Record<string, unknown>) {
  return {
    contractId: String(contract._id),
    contractNo: String(contract.contractNo ?? ""),
    title: String(contract.title ?? ""),
    contractAmount: Number(contract.contractAmount ?? 0),
    currency: String(contract.currency ?? "KRW"),
  };
}

function buildAccountingUnitSnapshot(unit: Record<string, unknown>) {
  return {
    accountingUnitId: String(unit._id),
    code: String(unit.code ?? ""),
    name: String(unit.name ?? ""),
    currency: String(unit.currency ?? "KRW"),
    country: String(unit.country ?? "KR"),
  };
}

function buildPeriodSnapshot(period: Record<string, unknown>) {
  return {
    periodId: String(period.periodId ?? ""),
    fiscalYear: Number(period.fiscalYear ?? 0),
    periodNo: Number(period.periodNo ?? 0),
    periodLabel: String(period.periodLabel ?? ""),
    startDate: String(period.startDate ?? ""),
    endDate: String(period.endDate ?? ""),
    closeStatus: String(period.closeStatus ?? ""),
  };
}

function buildModuleSnapshot(moduleDoc: Record<string, unknown>) {
  return {
    moduleId: String(moduleDoc._id),
    moduleNo: String(moduleDoc.moduleNo ?? ""),
    moduleType: String(moduleDoc.moduleType ?? ""),
    serialNo: String(moduleDoc.serialNo ?? ""),
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

const orgBlueprints = [
  {
    code: "ORG-DEMO-PLATFORM",
    name: "Platform Headquarters",
    category: "플랫폼",
    leadEmail: "hana.choi@demo.erp",
  },
  {
    code: "ORG-DEMO-BD",
    name: "Business Development Office",
    category: "운영",
    leadEmail: "minseo.park@demo.erp",
  },
  {
    code: "ORG-DEMO-PMO",
    name: "PMO Delivery Center",
    category: "운영",
    leadEmail: "hyunwoo.kim@demo.erp",
  },
  {
    code: "ORG-DEMO-SCM",
    name: "Supply Chain Control",
    category: "운영",
    leadEmail: "jihoon.lee@demo.erp",
  },
  {
    code: "ORG-DEMO-MFG",
    name: "Manufacturing Yard Operations",
    category: "운영",
    leadEmail: "soyeon.yoon@demo.erp",
  },
  {
    code: "ORG-DEMO-QHSE",
    name: "QA / HSE Office",
    category: "운영",
    leadEmail: "doyun.ahn@demo.erp",
  },
  {
    code: "ORG-DEMO-FIN",
    name: "Finance Control Tower",
    category: "운영",
    leadEmail: "eunji.kang@demo.erp",
  },
  {
    code: "ORG-DEMO-CMS",
    name: "Commissioning Services",
    category: "운영",
    leadEmail: "taeyang.jung@demo.erp",
  },
];

const roleBlueprints = [
  {
    code: "ROLE-DEMO-PLATFORM-ADMIN",
    name: "Demo Platform Admin",
    scope: "공통",
    permissions: [...allPermissionCatalog],
  },
  {
    code: "ROLE-DEMO-BD-LEAD",
    name: "Demo BD Lead",
    scope: "사업개발",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "business-development.read",
      "project.read",
      "workspace.read",
      "navigation.search",
      "notifications.read",
      "personalization.read",
      "party.create",
      "party.update",
      "contract.create",
      "contract.update",
      "contract.approve",
      "opportunity.create",
      "opportunity.update",
    ]),
  },
  {
    code: "ROLE-DEMO-PMO",
    name: "Demo PMO",
    scope: "프로젝트",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "business-development.read",
      "supply-chain.read",
      "manufacturing.read",
      "quality.read",
      "commissioning.read",
      "workspace.read",
      "project.create",
      "project.update",
      "site.create",
      "site.update",
      "unit.create",
      "unit.update",
      "system.create",
      "system.update",
      "wbs.create",
      "wbs.update",
      "execution-budget.create",
      "execution-budget.update",
      "execution-budget.approve",
    ]),
  },
  {
    code: "ROLE-DEMO-SCM",
    name: "Demo SCM Lead",
    scope: "공급망",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "supply-chain.read",
      "workspace.read",
      "vendor.create",
      "vendor.update",
      "material.create",
      "material.update",
      "purchase-order.create",
      "purchase-order.update",
      "purchase-order.submit",
      "purchase-order.approve",
      "purchase-order.reject",
      "purchase-order.cancel-approval",
      "purchase-order.receive",
      "purchase-order.cancel-receipt",
      "inventory.receipt",
      "inventory.issue",
      "inventory.transfer",
      "inventory.adjust-request",
      "inventory.adjust-approve",
      "inventory.adjust-reject",
    ]),
  },
  {
    code: "ROLE-DEMO-MFG",
    name: "Demo Manufacturing Lead",
    scope: "제작",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "manufacturing.read",
      "workspace.read",
      "module.create",
      "module.update",
      "manufacturing-order.create",
      "manufacturing-order.update",
      "shipment.create",
      "shipment.update",
      "shipment.approve",
    ]),
  },
  {
    code: "ROLE-DEMO-QA",
    name: "Demo Quality Lead",
    scope: "품질",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "quality.read",
      "safety.read",
      "workspace.read",
      "itp.create",
      "itp.update",
      "inspection.create",
      "inspection.update",
      "inspection.archive",
      "ncr.create",
      "ncr.update",
      "ncr.archive",
      "hse.create",
      "hse.update",
      "hse.archive",
    ]),
  },
  {
    code: "ROLE-DEMO-FIN",
    name: "Demo Finance Lead",
    scope: "재무",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "finance.read",
      "workspace.read",
      "accounting-unit.create",
      "accounting-unit.update",
      "accounting-unit.period-open",
      "accounting-unit.period-close",
      "accounting-unit.period-generate",
      "account.create",
      "account.update",
      "ap.create",
      "ap.approve",
      "ap.cancel-approval",
      "ap.pay",
      "ap.cancel-payment",
      "ar.create",
      "ar.issue",
      "ar.cancel-issue",
      "ar.collect",
      "ar.cancel-collection",
      "asset.create",
      "asset.update",
      "asset.archive",
      "asset.restore",
      "asset.depreciation-run",
      "journal-entry.create",
      "journal-entry.update",
      "journal-entry.submit",
      "journal-entry.post",
      "journal-entry.reverse",
    ]),
  },
  {
    code: "ROLE-DEMO-COMM",
    name: "Demo Commissioning Lead",
    scope: "시운전",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "project.read",
      "commissioning.read",
      "workspace.read",
      "commissioning-package.create",
      "commissioning-package.update",
      "commissioning-package.approve",
      "regulatory-action.create",
      "regulatory-action.update",
    ]),
  },
  {
    code: "ROLE-DEMO-EXEC",
    name: "Demo Executive Viewer",
    scope: "공통",
    permissions: expandPermissionCodes([
      "dashboard.read",
      "business-development.read",
      "project.read",
      "supply-chain.read",
      "manufacturing.read",
      "quality.read",
      "safety.read",
      "finance.read",
      "commissioning.read",
      "workspace.read",
      "navigation.search",
      "notifications.read",
      "personalization.read",
    ]),
  },
];

const userBlueprints = [
  {
    email: "hana.choi@demo.erp",
    name: "Hana Choi",
    employeeNo: "DEMO-0001",
    orgCode: "ORG-DEMO-PLATFORM",
    roleCode: "ROLE-DEMO-PLATFORM-ADMIN",
    defaultProjectCode: "PRJ-DEMO-ULSAN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-SINAN-2", "PRJ-DEMO-BUSAN-3", "PRJ-DEMO-ULJIN-1"],
  },
  {
    email: "minseo.park@demo.erp",
    name: "Minseo Park",
    employeeNo: "DEMO-0002",
    orgCode: "ORG-DEMO-BD",
    roleCode: "ROLE-DEMO-BD-LEAD",
    defaultProjectCode: "PRJ-DEMO-SINAN-2",
    projectCodes: ["PRJ-DEMO-SINAN-2", "PRJ-DEMO-BUSAN-3"],
  },
  {
    email: "junseo.lee@demo.erp",
    name: "Junseo Lee",
    employeeNo: "DEMO-0003",
    orgCode: "ORG-DEMO-BD",
    roleCode: "ROLE-DEMO-BD-LEAD",
    defaultProjectCode: "PRJ-DEMO-ULSAN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1"],
  },
  {
    email: "hyunwoo.kim@demo.erp",
    name: "Hyunwoo Kim",
    employeeNo: "DEMO-0004",
    orgCode: "ORG-DEMO-PMO",
    roleCode: "ROLE-DEMO-PMO",
    defaultProjectCode: "PRJ-DEMO-ULJIN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-SINAN-2", "PRJ-DEMO-ULJIN-1"],
  },
  {
    email: "soojin.kim@demo.erp",
    name: "Soojin Kim",
    employeeNo: "DEMO-0005",
    orgCode: "ORG-DEMO-PMO",
    roleCode: "ROLE-DEMO-PMO",
    defaultProjectCode: "PRJ-DEMO-BUSAN-3",
    projectCodes: ["PRJ-DEMO-BUSAN-3"],
  },
  {
    email: "jihoon.lee@demo.erp",
    name: "Jihoon Lee",
    employeeNo: "DEMO-0006",
    orgCode: "ORG-DEMO-SCM",
    roleCode: "ROLE-DEMO-SCM",
    defaultProjectCode: "PRJ-DEMO-ULSAN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-SINAN-2", "PRJ-DEMO-ULJIN-1"],
  },
  {
    email: "yerim.han@demo.erp",
    name: "Yerim Han",
    employeeNo: "DEMO-0007",
    orgCode: "ORG-DEMO-SCM",
    roleCode: "ROLE-DEMO-SCM",
    defaultProjectCode: "PRJ-DEMO-SINAN-2",
    projectCodes: ["PRJ-DEMO-SINAN-2", "PRJ-DEMO-BUSAN-3"],
  },
  {
    email: "soyeon.yoon@demo.erp",
    name: "Soyeon Yoon",
    employeeNo: "DEMO-0008",
    orgCode: "ORG-DEMO-MFG",
    roleCode: "ROLE-DEMO-MFG",
    defaultProjectCode: "PRJ-DEMO-ULSAN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-ULJIN-1"],
  },
  {
    email: "taemin.oh@demo.erp",
    name: "Taemin Oh",
    employeeNo: "DEMO-0009",
    orgCode: "ORG-DEMO-MFG",
    roleCode: "ROLE-DEMO-MFG",
    defaultProjectCode: "PRJ-DEMO-SINAN-2",
    projectCodes: ["PRJ-DEMO-SINAN-2"],
  },
  {
    email: "doyun.ahn@demo.erp",
    name: "Doyun Ahn",
    employeeNo: "DEMO-0010",
    orgCode: "ORG-DEMO-QHSE",
    roleCode: "ROLE-DEMO-QA",
    defaultProjectCode: "PRJ-DEMO-ULJIN-1",
    projectCodes: ["PRJ-DEMO-ULJIN-1", "PRJ-DEMO-ULSAN-1"],
  },
  {
    email: "jiwon.shin@demo.erp",
    name: "Jiwon Shin",
    employeeNo: "DEMO-0011",
    orgCode: "ORG-DEMO-QHSE",
    roleCode: "ROLE-DEMO-QA",
    defaultProjectCode: "PRJ-DEMO-SINAN-2",
    projectCodes: ["PRJ-DEMO-SINAN-2"],
  },
  {
    email: "eunji.kang@demo.erp",
    name: "Eunji Kang",
    employeeNo: "DEMO-0012",
    orgCode: "ORG-DEMO-FIN",
    roleCode: "ROLE-DEMO-FIN",
    defaultProjectCode: "PRJ-DEMO-ULJIN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-SINAN-2", "PRJ-DEMO-ULJIN-1"],
  },
  {
    email: "taeyang.jung@demo.erp",
    name: "Taeyang Jung",
    employeeNo: "DEMO-0013",
    orgCode: "ORG-DEMO-CMS",
    roleCode: "ROLE-DEMO-COMM",
    defaultProjectCode: "PRJ-DEMO-ULJIN-1",
    projectCodes: ["PRJ-DEMO-ULJIN-1", "PRJ-DEMO-SINAN-2"],
  },
  {
    email: "seorin.cho@demo.erp",
    name: "Seorin Cho",
    employeeNo: "DEMO-0014",
    orgCode: "ORG-DEMO-PLATFORM",
    roleCode: "ROLE-DEMO-EXEC",
    defaultProjectCode: "PRJ-DEMO-ULSAN-1",
    projectCodes: ["PRJ-DEMO-ULSAN-1", "PRJ-DEMO-SINAN-2", "PRJ-DEMO-BUSAN-3", "PRJ-DEMO-ULJIN-1"],
  },
];

const partyBlueprints = [
  {
    code: "PTY-DEMO-CUS-KHNP",
    name: "KHNP SMR Ventures",
    legalName: "KHNP SMR Ventures Co., Ltd.",
    partyRoles: ["customer"],
    taxId: "110-81-70001",
    country: "KR",
  },
  {
    code: "PTY-DEMO-CUS-SINAN",
    name: "Sinan Offshore Energy",
    legalName: "Sinan Offshore Energy Ltd.",
    partyRoles: ["customer"],
    taxId: "110-81-70002",
    country: "KR",
  },
  {
    code: "PTY-DEMO-CUS-BUSAN",
    name: "Busan Clean Reactor Institute",
    legalName: "Busan Clean Reactor Institute",
    partyRoles: ["customer"],
    taxId: "110-81-70003",
    country: "KR",
  },
  {
    code: "PTY-DEMO-CUS-ULSAN",
    name: "Ulsan Module Holdings",
    legalName: "Ulsan Module Holdings Corp.",
    partyRoles: ["customer"],
    taxId: "110-81-70004",
    country: "KR",
  },
  {
    code: "PTY-DEMO-CUS-HANRIM",
    name: "Hanrim Energy Development",
    legalName: "Hanrim Energy Development Co., Ltd.",
    partyRoles: ["customer"],
    taxId: "110-81-70005",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-DOOSAN",
    name: "Doosan Heavy Fabrication",
    legalName: "Doosan Heavy Fabrication Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50001",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-HANBIT",
    name: "Hanbit Instrumentation",
    legalName: "Hanbit Instrumentation Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50002",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-SEJIN",
    name: "Sejin Valve Systems",
    legalName: "Sejin Valve Systems Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50003",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-MIRAE",
    name: "Mirae Cable & Tray",
    legalName: "Mirae Cable & Tray Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50004",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-KTE",
    name: "KTE Structural Works",
    legalName: "KTE Structural Works Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50005",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-OCEAN",
    name: "Oceanic Logistics Korea",
    legalName: "Oceanic Logistics Korea Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50006",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-SAFELAB",
    name: "SafeLab Systems",
    legalName: "SafeLab Systems Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50007",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-HYUPJIN",
    name: "Hyupjin Automation",
    legalName: "Hyupjin Automation Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50008",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-WOORI",
    name: "Woori Steel Frame",
    legalName: "Woori Steel Frame Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50009",
    country: "KR",
  },
  {
    code: "PTY-DEMO-VND-DONGNAM",
    name: "Dongnam Pumps",
    legalName: "Dongnam Pumps Co., Ltd.",
    partyRoles: ["vendor"],
    taxId: "214-81-50010",
    country: "KR",
  },
  {
    code: "PTY-DEMO-PAR-EPC",
    name: "Global EPC Partners",
    legalName: "Global EPC Partners Ltd.",
    partyRoles: ["partner"],
    taxId: "130-81-80001",
    country: "SG",
  },
  {
    code: "PTY-DEMO-PAR-MARINE",
    name: "Marine Installation Alliance",
    legalName: "Marine Installation Alliance Inc.",
    partyRoles: ["partner"],
    taxId: "130-81-80002",
    country: "KR",
  },
];

const projectBlueprints = [
  {
    code: "PRJ-DEMO-ULSAN-1",
    name: "Ulsan SMR Module Yard Expansion",
    projectType: "EPC",
    customerCode: "PTY-DEMO-CUS-ULSAN",
    startDate: "2025-10-01",
    endDate: "2027-06-30",
    status: "active",
    sites: [
      {
        code: "SITE-ULSAN-FAB",
        name: "Ulsan Fabrication Yard",
        country: "KR",
        address: "77 Fabrication-ro, Ulsan",
        units: [
          {
            unitNo: "U1",
            capacity: "180MWth",
            systems: [
              {
                code: "SYS-ULS-RCS",
                name: "Reactor Coolant Train",
                discipline: "기계",
                wbs: [
                  { code: "WBS-001", name: "Reactor Vessel Fabrication", costCategory: "direct", budgetAmount: 9200000000 },
                  { code: "WBS-002", name: "Coolant Pump Skid Assembly", costCategory: "direct", budgetAmount: 3800000000 },
                ],
              },
              {
                code: "SYS-ULS-ELEC",
                name: "Electrical Balance of Plant",
                discipline: "전기",
                wbs: [
                  { code: "WBS-003", name: "Control Panel Assembly", costCategory: "direct", budgetAmount: 2600000000 },
                  { code: "WBS-004", name: "Cable Tray Installation", costCategory: "indirect", budgetAmount: 1800000000 },
                ],
              },
            ],
          },
        ],
      },
      {
        code: "SITE-ULSAN-PORT",
        name: "Ulsan Port Marshalling Yard",
        country: "KR",
        address: "12 Harbor Logistics Ave, Ulsan",
        units: [
          {
            unitNo: "Y1",
            capacity: "Logistics",
            systems: [
              {
                code: "SYS-ULS-STR",
                name: "Module Lift Support",
                discipline: "구조",
                wbs: [
                  { code: "WBS-005", name: "Structural Lifting Frame", costCategory: "direct", budgetAmount: 2400000000 },
                  { code: "WBS-006", name: "Port Handling Support", costCategory: "indirect", budgetAmount: 900000000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "PRJ-DEMO-SINAN-2",
    name: "Sinan Offshore Power Block A",
    projectType: "Offshore EPC",
    customerCode: "PTY-DEMO-CUS-SINAN",
    startDate: "2025-08-15",
    endDate: "2027-02-28",
    status: "active",
    sites: [
      {
        code: "SITE-SINAN-OFFSHORE",
        name: "Sinan Offshore Construction Base",
        country: "KR",
        address: "301 Offshore Complex, Sinan",
        units: [
          {
            unitNo: "A1",
            capacity: "120MW",
            systems: [
              {
                code: "SYS-SIN-PIPE",
                name: "Main Steam Piping",
                discipline: "배관",
                wbs: [
                  { code: "WBS-001", name: "Main Steam Pipe Spool", costCategory: "direct", budgetAmount: 6400000000 },
                  { code: "WBS-002", name: "Isolation Valve Package", costCategory: "direct", budgetAmount: 2100000000 },
                ],
              },
              {
                code: "SYS-SIN-I&C",
                name: "Instrumentation and Control",
                discipline: "계장/제어",
                wbs: [
                  { code: "WBS-003", name: "Safety Sensor Bundle", costCategory: "direct", budgetAmount: 1200000000 },
                  { code: "WBS-004", name: "Cabinet Commissioning Loop", costCategory: "indirect", budgetAmount: 780000000 },
                ],
              },
            ],
          },
        ],
      },
      {
        code: "SITE-SINAN-YARD",
        name: "Sinan Cable Storage Yard",
        country: "KR",
        address: "18 Yard Road, Sinan",
        units: [
          {
            unitNo: "Y-A",
            capacity: "Storage",
            systems: [
              {
                code: "SYS-SIN-CBL",
                name: "Cable Routing Support",
                discipline: "전기",
                wbs: [
                  { code: "WBS-005", name: "Cable Tray and Support", costCategory: "direct", budgetAmount: 1700000000 },
                  { code: "WBS-006", name: "Temporary Power Distribution", costCategory: "indirect", budgetAmount: 640000000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "PRJ-DEMO-BUSAN-3",
    name: "Busan Pilot Reactor Demo",
    projectType: "Pilot",
    customerCode: "PTY-DEMO-CUS-BUSAN",
    startDate: "2026-01-15",
    endDate: "2026-12-31",
    status: "planning",
    sites: [
      {
        code: "SITE-BUSAN-PILOT",
        name: "Busan Pilot Facility",
        country: "KR",
        address: "9 Demo Campus, Busan",
        units: [
          {
            unitNo: "P1",
            capacity: "10MW",
            systems: [
              {
                code: "SYS-BUS-LAB",
                name: "Reactor Test Bay",
                discipline: "공정",
                wbs: [
                  { code: "WBS-001", name: "Pilot Reactor Assembly", costCategory: "direct", budgetAmount: 1500000000 },
                  { code: "WBS-002", name: "Test Sensor Rack", costCategory: "direct", budgetAmount: 430000000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "PRJ-DEMO-ULJIN-1",
    name: "Uljin Alpha Unit 1",
    projectType: "Nuclear EPC",
    customerCode: "PTY-DEMO-CUS-KHNP",
    startDate: "2024-09-01",
    endDate: "2026-09-30",
    status: "active",
    sites: [
      {
        code: "SITE-ULJIN-MAIN",
        name: "Uljin Main Site",
        country: "KR",
        address: "1 Nuclear Valley, Uljin",
        units: [
          {
            unitNo: "U1",
            capacity: "300MW",
            systems: [
              {
                code: "SYS-ULJ-RCS",
                name: "Reactor Pressure Boundary",
                discipline: "기계",
                wbs: [
                  { code: "WBS-001", name: "Reactor Pressure Vessel Install", costCategory: "direct", budgetAmount: 11200000000 },
                  { code: "WBS-002", name: "Primary Pump Alignment", costCategory: "direct", budgetAmount: 4200000000 },
                ],
              },
              {
                code: "SYS-ULJ-CMS",
                name: "Control and Monitoring Suite",
                discipline: "계장/제어",
                wbs: [
                  { code: "WBS-003", name: "Cabinet Hook-up", costCategory: "direct", budgetAmount: 2400000000 },
                  { code: "WBS-004", name: "Loop Check and FAT", costCategory: "indirect", budgetAmount: 1100000000 },
                ],
              },
            ],
          },
        ],
      },
      {
        code: "SITE-ULJIN-YARD",
        name: "Uljin Module Yard",
        country: "KR",
        address: "55 Module Yard Blvd, Uljin",
        units: [
          {
            unitNo: "Y1",
            capacity: "Marshalling",
            systems: [
              {
                code: "SYS-ULJ-STR",
                name: "Module Support Structure",
                discipline: "구조",
                wbs: [
                  { code: "WBS-005", name: "Support Frame Erection", costCategory: "direct", budgetAmount: 2100000000 },
                  { code: "WBS-006", name: "Turnover Preparation", costCategory: "indirect", budgetAmount: 760000000 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const materialBlueprints: Array<[string, string, string, string, string, string]> = [
  ["MAT-DEMO-RPV-001", "Reactor Pressure Vessel", "EA", "RPV Type-A / 160t", "Doosan Heavy Fabrication", "Nuclear Equipment"],
  ["MAT-DEMO-PNL-001", "Control Panel", "EA", "480V / I&C local panel", "Hanbit Instrumentation", "Electrical"],
  ["MAT-DEMO-SEN-001", "Safety Sensor Bundle", "SET", "SIL-rated sensor set", "SafeLab Systems", "Instrumentation"],
  ["MAT-DEMO-PIP-001", "Stainless Pipe 6in", "M", "ASTM A312 TP316L", "Sejin Valve Systems", "Piping"],
  ["MAT-DEMO-STR-001", "Structural Steel Frame", "TON", "Offshore support frame", "Woori Steel Frame", "Structural"],
  ["MAT-DEMO-VLV-001", "Main Steam Isolation Valve", "EA", "MSIV Class 1500", "Sejin Valve Systems", "Piping"],
  ["MAT-DEMO-CBL-001", "Cable Tray", "M", "Hot dip galvanized", "Mirae Cable & Tray", "Electrical"],
  ["MAT-DEMO-CAB-001", "Instrumentation Cabinet", "EA", "IP55 panel cabinet", "Hanbit Instrumentation", "Instrumentation"],
  ["MAT-DEMO-PMP-001", "Primary Pump Skid", "SET", "Reactor coolant pump skid", "Dongnam Pumps", "Mechanical"],
  ["MAT-DEMO-FOB-001", "Fiber Optic Bundle", "M", "Single mode fiber", "Hyupjin Automation", "Instrumentation"],
  ["MAT-DEMO-ANC-001", "Anchor Bolt Set", "SET", "M30 galvanized anchor", "KTE Structural Works", "Structural"],
  ["MAT-DEMO-CABIN-001", "Temporary Facility Cabin", "EA", "Prefab office cabin", "KTE Structural Works", "Temporary"],
  ["MAT-DEMO-SEAL-001", "Fire Seal Package", "SET", "Cable penetration seal", "SafeLab Systems", "Safety"],
  ["MAT-DEMO-RACK-001", "Lab Sensor Rack", "SET", "Pilot reactor rack", "SafeLab Systems", "Testing"],
  ["MAT-DEMO-PP-001", "Main Steam Pipe", "M", "SA-335 P22", "Doosan Heavy Fabrication", "Piping"],
  ["MAT-DEMO-CFG-001", "Config Server Cabinet", "EA", "Digital control server cabinet", "Hyupjin Automation", "Electrical"],
];

const opportunityBlueprints: Array<[string, string, string, string, string, number]> = [
  ["OPP-DEMO-2026-001", "Yeosu Floating SMR Utility Block", "PTY-DEMO-CUS-HANRIM", "EPC", "qualification", 84000000000],
  ["OPP-DEMO-2026-002", "Ulsan Yard Capacity Upgrade Phase 2", "PTY-DEMO-CUS-ULSAN", "Framework", "proposal", 32000000000],
  ["OPP-DEMO-2026-003", "Sinan Offshore Auxiliary Island", "PTY-DEMO-CUS-SINAN", "EPC", "negotiation", 117000000000],
  ["OPP-DEMO-2026-004", "Busan Demo Heat Exchanger Package", "PTY-DEMO-CUS-BUSAN", "Supply", "proposal", 6800000000],
  ["OPP-DEMO-2026-005", "Uljin Alpha Unit 2 Early Works", "PTY-DEMO-CUS-KHNP", "EPC", "awarded", 158000000000],
  ["OPP-DEMO-2026-006", "Geoje Marine Support Upgrade", "PTY-DEMO-CUS-HANRIM", "Service", "lost", 5200000000],
  ["OPP-DEMO-2026-007", "Advanced Instrumentation Retrofit", "PTY-DEMO-CUS-KHNP", "Framework", "negotiation", 14500000000],
  ["OPP-DEMO-2026-008", "Busan Safety Test Loop", "PTY-DEMO-CUS-BUSAN", "Pilot", "qualification", 2100000000],
];

const contractBlueprints = [
  {
    contractNo: "CTR-DEMO-ULSAN-001",
    contractType: "EPC",
    title: "Ulsan SMR Module Yard Expansion Main Contract",
    projectCode: "PRJ-DEMO-ULSAN-1",
    customerCode: "PTY-DEMO-CUS-ULSAN",
    partnerCodes: ["PTY-DEMO-PAR-EPC"],
    startDate: "2025-10-01",
    endDate: "2027-06-30",
    contractAmount: 118000000000,
    status: "active",
    amendments: [
      { version: "1차", date: "2026-02-05", amount: 128000000000, reason: "Yard handling scope expansion" },
    ],
  },
  {
    contractNo: "CTR-DEMO-SINAN-001",
    contractType: "EPC",
    title: "Sinan Offshore Power Block A Main Contract",
    projectCode: "PRJ-DEMO-SINAN-2",
    customerCode: "PTY-DEMO-CUS-SINAN",
    partnerCodes: ["PTY-DEMO-PAR-EPC", "PTY-DEMO-PAR-MARINE"],
    startDate: "2025-08-15",
    endDate: "2027-02-28",
    contractAmount: 96000000000,
    status: "active",
    amendments: [],
  },
  {
    contractNo: "CTR-DEMO-BUSAN-001",
    contractType: "Pilot",
    title: "Busan Pilot Reactor Demonstration Contract",
    projectCode: "PRJ-DEMO-BUSAN-3",
    customerCode: "PTY-DEMO-CUS-BUSAN",
    partnerCodes: [],
    startDate: "2026-01-15",
    endDate: "2026-12-31",
    contractAmount: 3200000000,
    status: "draft",
    amendments: [],
  },
  {
    contractNo: "CTR-DEMO-ULJIN-001",
    contractType: "EPC",
    title: "Uljin Alpha Unit 1 Mechanical Completion Contract",
    projectCode: "PRJ-DEMO-ULJIN-1",
    customerCode: "PTY-DEMO-CUS-KHNP",
    partnerCodes: ["PTY-DEMO-PAR-EPC"],
    startDate: "2024-09-01",
    endDate: "2026-09-30",
    contractAmount: 145000000000,
    status: "active",
    amendments: [
      { version: "1차", date: "2025-06-12", amount: 149000000000, reason: "Control room scope added" },
      { version: "2차", date: "2026-01-22", amount: 154000000000, reason: "Turnover acceleration package" },
    ],
  },
  {
    contractNo: "CTR-DEMO-PIPE-001",
    contractType: "Framework",
    title: "Hanrim Early Works Framework",
    projectCode: null,
    customerCode: "PTY-DEMO-CUS-HANRIM",
    partnerCodes: [],
    startDate: "2026-03-01",
    endDate: "2027-03-01",
    contractAmount: 18000000000,
    status: "review",
    amendments: [],
  },
];

const purchaseOrderBlueprints = [
  {
    poNo: "PO-DEMO-ULS-001",
    projectCode: "PRJ-DEMO-ULSAN-1",
    wbsCode: "SYS-ULS-RCS/WBS-001",
    vendorCode: "PTY-DEMO-VND-DOOSAN",
    status: "completed",
    orderDate: -70,
    dueDate: -20,
    lines: [
      { materialCode: "MAT-DEMO-RPV-001", quantity: 1, unitPrice: 4200000000 },
      { materialCode: "MAT-DEMO-PMP-001", quantity: 1, unitPrice: 960000000 },
    ],
    receipts: [
      {
        receiptNo: "RCT-DEMO-ULS-001",
        siteCode: "SITE-ULSAN-FAB",
        storageLocation: "FAB-A1",
        transactionDate: -32,
        lineQuantities: { 1: 1, 2: 1 },
      },
    ],
  },
  {
    poNo: "PO-DEMO-ULS-002",
    projectCode: "PRJ-DEMO-ULSAN-1",
    wbsCode: "SYS-ULS-ELEC/WBS-003",
    vendorCode: "PTY-DEMO-VND-HANBIT",
    status: "partial-received",
    orderDate: -48,
    dueDate: 5,
    lines: [
      { materialCode: "MAT-DEMO-PNL-001", quantity: 6, unitPrice: 145000000 },
      { materialCode: "MAT-DEMO-CFG-001", quantity: 2, unitPrice: 188000000 },
    ],
    receipts: [
      {
        receiptNo: "RCT-DEMO-ULS-002",
        siteCode: "SITE-ULSAN-FAB",
        storageLocation: "ELEC-01",
        transactionDate: -12,
        lineQuantities: { 1: 4, 2: 1 },
      },
    ],
  },
  {
    poNo: "PO-DEMO-SIN-001",
    projectCode: "PRJ-DEMO-SINAN-2",
    wbsCode: "SYS-SIN-PIPE/WBS-001",
    vendorCode: "PTY-DEMO-VND-DOOSAN",
    status: "completed",
    orderDate: -58,
    dueDate: -15,
    lines: [
      { materialCode: "MAT-DEMO-PP-001", quantity: 820, unitPrice: 1820000 },
      { materialCode: "MAT-DEMO-VLV-001", quantity: 4, unitPrice: 310000000 },
    ],
    receipts: [
      {
        receiptNo: "RCT-DEMO-SIN-001",
        siteCode: "SITE-SINAN-OFFSHORE",
        storageLocation: "PIPE-YARD",
        transactionDate: -18,
        lineQuantities: { 1: 820, 2: 4 },
      },
    ],
  },
  {
    poNo: "PO-DEMO-SIN-002",
    projectCode: "PRJ-DEMO-SINAN-2",
    wbsCode: "SYS-SIN-I&C/WBS-003",
    vendorCode: "PTY-DEMO-VND-SAFELAB",
    status: "approved",
    orderDate: -21,
    dueDate: 14,
    lines: [
      { materialCode: "MAT-DEMO-SEN-001", quantity: 8, unitPrice: 58000000 },
      { materialCode: "MAT-DEMO-RACK-001", quantity: 2, unitPrice: 126000000 },
    ],
    receipts: [],
  },
  {
    poNo: "PO-DEMO-SIN-003",
    projectCode: "PRJ-DEMO-SINAN-2",
    wbsCode: "SYS-SIN-CBL/WBS-005",
    vendorCode: "PTY-DEMO-VND-MIRAE",
    status: "submitted",
    orderDate: -5,
    dueDate: 21,
    lines: [
      { materialCode: "MAT-DEMO-CBL-001", quantity: 1500, unitPrice: 48000 },
      { materialCode: "MAT-DEMO-SEAL-001", quantity: 16, unitPrice: 3200000 },
    ],
    receipts: [],
  },
  {
    poNo: "PO-DEMO-BUS-001",
    projectCode: "PRJ-DEMO-BUSAN-3",
    wbsCode: "SYS-BUS-LAB/WBS-002",
    vendorCode: "PTY-DEMO-VND-SAFELAB",
    status: "draft",
    orderDate: 0,
    dueDate: 35,
    lines: [
      { materialCode: "MAT-DEMO-SEN-001", quantity: 3, unitPrice: 61000000 },
      { materialCode: "MAT-DEMO-RACK-001", quantity: 1, unitPrice: 122000000 },
    ],
    receipts: [],
  },
  {
    poNo: "PO-DEMO-ULJ-001",
    projectCode: "PRJ-DEMO-ULJIN-1",
    wbsCode: "SYS-ULJ-RCS/WBS-001",
    vendorCode: "PTY-DEMO-VND-DOOSAN",
    status: "completed",
    orderDate: -120,
    dueDate: -60,
    lines: [
      { materialCode: "MAT-DEMO-RPV-001", quantity: 1, unitPrice: 4380000000 },
      { materialCode: "MAT-DEMO-ANC-001", quantity: 6, unitPrice: 4200000 },
    ],
    receipts: [
      {
        receiptNo: "RCT-DEMO-ULJ-001",
        siteCode: "SITE-ULJIN-YARD",
        storageLocation: "YARD-A1",
        transactionDate: -75,
        lineQuantities: { 1: 1, 2: 6 },
      },
    ],
  },
  {
    poNo: "PO-DEMO-ULJ-002",
    projectCode: "PRJ-DEMO-ULJIN-1",
    wbsCode: "SYS-ULJ-CMS/WBS-003",
    vendorCode: "PTY-DEMO-VND-HANBIT",
    status: "partial-received",
    orderDate: -55,
    dueDate: 3,
    lines: [
      { materialCode: "MAT-DEMO-CAB-001", quantity: 4, unitPrice: 186000000 },
      { materialCode: "MAT-DEMO-FOB-001", quantity: 600, unitPrice: 62000 },
    ],
    receipts: [
      {
        receiptNo: "RCT-DEMO-ULJ-002-A",
        siteCode: "SITE-ULJIN-MAIN",
        storageLocation: "I&C-01",
        transactionDate: -25,
        lineQuantities: { 1: 2, 2: 300 },
      },
      {
        receiptNo: "RCT-DEMO-ULJ-002-B",
        siteCode: "SITE-ULJIN-MAIN",
        storageLocation: "I&C-01",
        transactionDate: -9,
        lineQuantities: { 1: 1, 2: 100 },
      },
    ],
  },
  {
    poNo: "PO-DEMO-ULJ-003",
    projectCode: "PRJ-DEMO-ULJIN-1",
    wbsCode: "SYS-ULJ-STR/WBS-005",
    vendorCode: "PTY-DEMO-VND-WOORI",
    status: "approved",
    orderDate: -16,
    dueDate: 18,
    lines: [
      { materialCode: "MAT-DEMO-STR-001", quantity: 38, unitPrice: 18500000 },
    ],
    receipts: [],
  },
  {
    poNo: "PO-DEMO-ULJ-004",
    projectCode: "PRJ-DEMO-ULJIN-1",
    wbsCode: "SYS-ULJ-STR/WBS-006",
    vendorCode: "PTY-DEMO-VND-OCEAN",
    status: "rejected",
    orderDate: -14,
    dueDate: 22,
    lines: [
      { materialCode: "MAT-DEMO-CABIN-001", quantity: 2, unitPrice: 98000000 },
    ],
    receipts: [],
  },
];

const moduleBlueprints: Array<[string, string, string, string, string, string, string]> = [
  ["MOD-DEMO-ULS-001", "PRJ-DEMO-ULSAN-1", "SYS-ULS-RCS", "Reactor Vessel Module", "SN-ULS-24001", "PTY-DEMO-VND-DOOSAN", "fabricating"],
  ["MOD-DEMO-ULS-002", "PRJ-DEMO-ULSAN-1", "SYS-ULS-ELEC", "Electrical Control Module", "SN-ULS-24002", "PTY-DEMO-VND-HANBIT", "testing"],
  ["MOD-DEMO-ULS-003", "PRJ-DEMO-ULSAN-1", "SYS-ULS-STR", "Lift Support Module", "SN-ULS-24003", "PTY-DEMO-VND-KTE", "shipped"],
  ["MOD-DEMO-SIN-001", "PRJ-DEMO-SINAN-2", "SYS-SIN-PIPE", "Steam Header Module", "SN-SIN-24001", "PTY-DEMO-VND-DOOSAN", "fabricating"],
  ["MOD-DEMO-SIN-002", "PRJ-DEMO-SINAN-2", "SYS-SIN-I&C", "I&C Cabinet Module", "SN-SIN-24002", "PTY-DEMO-VND-HANBIT", "planned"],
  ["MOD-DEMO-SIN-003", "PRJ-DEMO-SINAN-2", "SYS-SIN-CBL", "Cable Marshalling Rack", "SN-SIN-24003", "PTY-DEMO-VND-MIRAE", "testing"],
  ["MOD-DEMO-BUS-001", "PRJ-DEMO-BUSAN-3", "SYS-BUS-LAB", "Pilot Reactor Skid", "SN-BUS-26001", "PTY-DEMO-VND-SAFELAB", "planned"],
  ["MOD-DEMO-ULJ-001", "PRJ-DEMO-ULJIN-1", "SYS-ULJ-RCS", "Reactor Boundary Module", "SN-ULJ-23001", "PTY-DEMO-VND-DOOSAN", "installed"],
  ["MOD-DEMO-ULJ-002", "PRJ-DEMO-ULJIN-1", "SYS-ULJ-CMS", "Control Room Module", "SN-ULJ-23002", "PTY-DEMO-VND-HANBIT", "testing"],
  ["MOD-DEMO-ULJ-003", "PRJ-DEMO-ULJIN-1", "SYS-ULJ-STR", "Support Structure Module", "SN-ULJ-23003", "PTY-DEMO-VND-WOORI", "shipped"],
];

function createAccountingPeriods() {
  const periods = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const referenceDate = new Date(Date.UTC(2026, monthIndex, 1));
    const closeStatus =
      monthIndex < 2 ? "closed" : monthIndex === 2 ? "open" : "plan";
    periods.push(buildMonthlyAccountingPeriod(referenceDate, 1, closeStatus));
  }
  return periods;
}

type SeedAccountDoc = ReturnType<typeof makeDoc> & {
  _id: ObjectId;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountCode: string | null;
  postingAllowed: boolean;
  description: string;
  status: string;
};

function createAccounts(): SeedAccountDoc[] {
  const specs: Array<[string, string, string, string | null, boolean]> = [
    ["100000", "Assets", "asset", null, false],
    ["110000", "Cash and Cash Equivalents", "asset", "100000", false],
    ["111000", "Operating Bank Account", "asset", "110000", true],
    ["120000", "Receivables", "asset", "100000", false],
    ["121000", "Trade Receivables", "asset", "120000", true],
    ["130000", "Inventory", "asset", "100000", true],
    ["150000", "Fixed Assets", "asset", "100000", false],
    ["151000", "Plant Equipment", "asset", "150000", true],
    ["200000", "Liabilities", "liability", null, false],
    ["210000", "Payables", "liability", "200000", false],
    ["211000", "Trade Payables", "liability", "210000", true],
    ["300000", "Equity", "equity", null, false],
    ["400000", "Revenue", "revenue", null, false],
    ["410000", "Engineering Revenue", "revenue", "400000", true],
    ["420000", "Commissioning Revenue", "revenue", "400000", true],
    ["500000", "Expenses", "expense", null, false],
    ["510000", "Materials Expense", "expense", "500000", true],
    ["520000", "Subcontract Expense", "expense", "500000", true],
    ["530000", "Freight Expense", "expense", "500000", true],
    ["540000", "Quality Expense", "expense", "500000", true],
  ];

  return specs.map(
    ([accountCode, accountName, accountType, parentAccountCode, postingAllowed], index) =>
      makeDoc(
        {
          _id: new ObjectId(),
          accountCode,
          accountName,
          accountType,
          parentAccountCode,
          postingAllowed,
          description: `${accountName} seeded for demo environment`,
          status: "active",
        },
        -120 + index,
        8,
      ) as SeedAccountDoc,
  );
}

function buildSeedDataset() {
  const orgIdByCode = new Map(orgBlueprints.map((item) => [item.code, new ObjectId()]));
  const roleIdByCode = new Map(roleBlueprints.map((item) => [item.code, new ObjectId()]));
  const userIdByEmail = new Map(userBlueprints.map((item) => [item.email, new ObjectId()]));
  const partyIdByCode = new Map(partyBlueprints.map((item) => [item.code, new ObjectId()]));
  const projectIdByCode = new Map(projectBlueprints.map((item) => [item.code, new ObjectId()]));
  const siteIdByCode = new Map<string, ObjectId>();
  const unitIdByKey = new Map<string, ObjectId>();
  const systemIdByKey = new Map<string, ObjectId>();
  const wbsIdByKey = new Map<string, ObjectId>();
  const budgetIdByKey = new Map<string, ObjectId>();
  const materialIdByCode = new Map(materialBlueprints.map((item) => [item[0], new ObjectId()]));
  const moduleIdByNo = new Map(moduleBlueprints.map((item) => [item[0], new ObjectId()]));
  const contractIdByNo = new Map(contractBlueprints.map((item) => [item.contractNo, new ObjectId()]));
  const poIdByNo = new Map(purchaseOrderBlueprints.map((item) => [item.poNo, new ObjectId()]));

  const orgNameByCode = new Map(orgBlueprints.map((item) => [item.code, item.name]));
  const roleNameByCode = new Map(roleBlueprints.map((item) => [item.code, item.name]));

  const projects: Record<string, any>[] = [];
  const sites: Record<string, any>[] = [];
  const units: Record<string, any>[] = [];
  const systems: Record<string, any>[] = [];
  const wbsItems: Record<string, any>[] = [];
  const budgets: Record<string, any>[] = [];
  const progressRecords: Record<string, any>[] = [];

  for (const projectBlueprint of projectBlueprints) {
    const customerParty = {
      _id: partyIdByCode.get(projectBlueprint.customerCode)!,
      ...partyBlueprints.find((item) => item.code === projectBlueprint.customerCode)!,
    };

    const projectDoc = makeDoc(
      {
        _id: projectIdByCode.get(projectBlueprint.code)!,
        code: projectBlueprint.code,
        name: projectBlueprint.name,
        projectType: projectBlueprint.projectType,
        customerSnapshot: buildPartySnapshot(customerParty),
        startDate: projectBlueprint.startDate,
        endDate: projectBlueprint.endDate,
        currency: "KRW",
        siteSummaries: [],
        status: projectBlueprint.status,
      },
      -180,
      8,
    );
    projects.push(projectDoc);

    for (const siteBlueprint of projectBlueprint.sites) {
      const siteId = new ObjectId();
      siteIdByCode.set(siteBlueprint.code, siteId);
      const siteDoc = makeDoc(
        {
          _id: siteId,
          projectSnapshot: buildProjectSnapshot(projectDoc),
          code: siteBlueprint.code,
          name: siteBlueprint.name,
          country: siteBlueprint.country,
          address: siteBlueprint.address,
          siteManagerSnapshot: makeActor(
            "Hyunwoo Kim",
            "PMO Delivery Center",
            "hyunwoo.kim@demo.erp",
            "DEMO-0004",
          ),
          unitSummaries: [],
          status: "active",
        },
        -160,
        9,
      );
      sites.push(siteDoc);

      for (const unitBlueprint of siteBlueprint.units) {
        const unitId = new ObjectId();
        const unitKey = `${siteBlueprint.code}/${unitBlueprint.unitNo}`;
        unitIdByKey.set(unitKey, unitId);
        const unitDoc = makeDoc(
          {
            _id: unitId,
            projectSnapshot: buildProjectSnapshot(projectDoc),
            siteSnapshot: buildSiteSnapshot(siteDoc),
            unitNo: unitBlueprint.unitNo,
            capacity: unitBlueprint.capacity,
            systemSummaries: [],
            status: "active",
          },
          -150,
          9,
        );
        units.push(unitDoc);

        for (const systemBlueprint of unitBlueprint.systems) {
          const systemId = new ObjectId();
          const systemKey = `${projectBlueprint.code}/${systemBlueprint.code}`;
          systemIdByKey.set(systemKey, systemId);
          const systemDoc = makeDoc(
            {
              _id: systemId,
              projectSnapshot: buildProjectSnapshot(projectDoc),
              unitSnapshot: {
                unitId: unitId.toString(),
                unitNo: unitBlueprint.unitNo,
              },
              code: systemBlueprint.code,
              name: systemBlueprint.name,
              discipline: systemBlueprint.discipline,
              parentSystemSnapshot: null,
              turnoverBoundary: `${systemBlueprint.name} turnover boundary`,
              wbsSummaries: [],
              status: "active",
            },
            -140,
            9,
          );
          systems.push(systemDoc);

          for (const wbsBlueprint of systemBlueprint.wbs) {
            const wbsId = new ObjectId();
            const wbsKey = `${systemBlueprint.code}/${wbsBlueprint.code}`;
            wbsIdByKey.set(wbsKey, wbsId);
            const wbsDoc = makeDoc(
              {
                _id: wbsId,
                projectSnapshot: buildProjectSnapshot(projectDoc),
                unitSnapshot: {
                  unitId: unitId.toString(),
                  unitNo: unitBlueprint.unitNo,
                },
                systemSnapshot: buildSystemSnapshot(systemDoc),
                parentWbsSnapshot: null,
                code: wbsBlueprint.code,
                name: wbsBlueprint.name,
                discipline: systemBlueprint.discipline,
                costCategory: wbsBlueprint.costCategory,
                status: "active",
              },
              -130,
              9,
            );
            wbsItems.push(wbsDoc);

            const budgetId = new ObjectId();
            budgetIdByKey.set(wbsKey, budgetId);
            const budgetDoc = makeDoc(
              {
                _id: budgetId,
                budgetCode: `EB-${projectBlueprint.code}-${wbsBlueprint.code}`,
                projectSnapshot: buildProjectSnapshot(projectDoc),
                wbsSnapshot: buildWbsSnapshot(wbsDoc),
                version: "v1.0",
                currency: "KRW",
                costItems: [
                  {
                    costCategory: wbsBlueprint.costCategory,
                    description: `${wbsBlueprint.name} direct cost`,
                    quantity: 1,
                    unitPrice: wbsBlueprint.budgetAmount,
                    amount: wbsBlueprint.budgetAmount,
                  },
                ],
                totalAmount: wbsBlueprint.budgetAmount,
                approvalStatus:
                  projectBlueprint.code === "PRJ-DEMO-BUSAN-3" ? "draft" : "approved",
                effectiveDate: projectBlueprint.startDate,
                status: "active",
                usageSummary: buildEmptyExecutionBudgetUsageSummary(),
              },
              -120,
              9,
            );
            budgets.push(budgetDoc);

            progressRecords.push(
              makeDoc(
                {
                  _id: new ObjectId(),
                  projectSnapshot: buildProjectSnapshot(projectDoc),
                  siteSnapshot: buildSiteSnapshot(siteDoc),
                  unitSnapshot: {
                    unitId: unitId.toString(),
                    unitNo: unitBlueprint.unitNo,
                  },
                  systemSnapshot: buildSystemSnapshot(systemDoc),
                  wbsSnapshot: buildWbsSnapshot(wbsDoc),
                  recordDate: isoDate(-10),
                  progressType:
                    projectBlueprint.code === "PRJ-DEMO-BUSAN-3"
                      ? "planning"
                      : "earned-progress",
                  quantity: projectBlueprint.code === "PRJ-DEMO-BUSAN-3" ? 12 : 68,
                  amount: Math.round(wbsBlueprint.budgetAmount * 0.34),
                  status: "active",
                },
                -10,
                10,
              ),
            );
          }
        }
      }
    }
  }

  for (const projectDoc of projects) {
    const projectSites = sites.filter(
      (siteDoc) => siteDoc.projectSnapshot.projectId === String(projectDoc._id),
    );
    projectDoc.siteSummaries = projectSites.map((siteDoc) => buildSiteSummary(siteDoc));
  }

  for (const siteDoc of sites) {
    const siteUnits = units.filter((unitDoc) => unitDoc.siteSnapshot.siteId === String(siteDoc._id));
    siteDoc.unitSummaries = siteUnits.map((unitDoc) => buildUnitSummary(unitDoc));
  }

  for (const unitDoc of units) {
    const unitSystems = systems.filter(
      (systemDoc) => systemDoc.unitSnapshot.unitId === String(unitDoc._id),
    );
    unitDoc.systemSummaries = unitSystems.map((systemDoc) => buildSystemSummary(systemDoc));
  }

  for (const systemDoc of systems) {
    const systemWbs = wbsItems.filter(
      (wbsDoc) => wbsDoc.systemSnapshot?.systemId === String(systemDoc._id),
    );
    systemDoc.wbsSummaries = systemWbs.map((wbsDoc) => buildWbsSnapshot(wbsDoc));
  }

  const materials: Record<string, any>[] = materialBlueprints.map((blueprint, index) =>
    makeDoc(
      {
        _id: materialIdByCode.get(blueprint[0])!,
        materialCode: blueprint[0],
        description: blueprint[1],
        uom: blueprint[2],
        specification: blueprint[3],
        manufacturerName: blueprint[4],
        category: blueprint[5],
        certificates: [
          {
            certificateNo: `CERT-${blueprint[0]}`,
            certificateType: "material-test",
            issuedAt: isoDate(-90 + index),
            issuer: blueprint[4],
          },
        ],
        status: "active",
      },
      -100 + index,
      8,
    ),
  );

  const contracts: Record<string, any>[] = contractBlueprints.map((blueprint, index) => {
    const projectDoc = blueprint.projectCode
      ? projects.find((item) => item.code === blueprint.projectCode) ?? null
      : null;
    const customerDoc = {
      _id: partyIdByCode.get(blueprint.customerCode)!,
      ...partyBlueprints.find((item) => item.code === blueprint.customerCode)!,
    };
    const partnerSnapshots = blueprint.partnerCodes.map((code) =>
      buildPartySnapshot({
        _id: partyIdByCode.get(code)!,
        ...partyBlueprints.find((item) => item.code === code)!,
      }),
    );
    const createdAt = isoTimestamp(-95 + index, 10);
    const actor = makeActor("Minseo Park", "Business Development Office", "minseo.park@demo.erp", "DEMO-0002");
    return {
      _id: contractIdByNo.get(blueprint.contractNo)!,
      seedTag: SEED_TAG,
      contractNo: blueprint.contractNo,
      contractType: blueprint.contractType,
      title: blueprint.title,
      projectSnapshot: projectDoc ? buildProjectSnapshot(projectDoc) : null,
      customerSnapshot: buildPartySnapshot(customerDoc),
      partnerSnapshots,
      startDate: blueprint.startDate,
      endDate: blueprint.endDate,
      contractAmount: blueprint.contractAmount,
      currency: "KRW",
      amendments: blueprint.amendments.map((item, amendmentIndex) => ({
        id: new ObjectId().toString(),
        version: item.version,
        date: item.date,
        amount: item.amount,
        reason: item.reason,
        createdAt: isoTimestamp(-70 + amendmentIndex, 11),
        createdBy: actor,
      })),
      changeHistory: [
        createChangeEntry({
          type: "contract.created",
          title: "계약 등록",
          description: "영업 계약이 등록되었습니다.",
          occurredAt: createdAt,
          actor,
        }),
      ],
      fileRefs: [],
      status: blueprint.status,
      ...buildCreateMetadata(seedProfile, createdAt),
    };
  });

  const accountingPeriods = createAccountingPeriods();
  const accountingUnit = makeDoc(
    {
      _id: new ObjectId(),
      code: "AU-DEMO-KR-001",
      name: "Korea Primary Ledger",
      currency: "KRW",
      country: "KR",
      fiscalYearStartMonth: 1,
      periods: accountingPeriods,
      status: "active",
    },
    -200,
    8,
  );
  const openPeriod =
    accountingPeriods.find((period) => period.periodLabel === "2026-03") ?? accountingPeriods[0];
  const accounts = createAccounts();
  const accountByCode = new Map(accounts.map((doc) => [doc.accountCode, doc]));

  const opportunities: Record<string, any>[] = opportunityBlueprints.map((blueprint, index) => {
    const customerDoc = {
      _id: partyIdByCode.get(blueprint[2])!,
      ...partyBlueprints.find((item) => item.code === blueprint[2])!,
    };
    const owner =
      index % 2 === 0
        ? makeActor("Minseo Park", "Business Development Office", "minseo.park@demo.erp", "DEMO-0002")
        : makeActor("Junseo Lee", "Business Development Office", "junseo.lee@demo.erp", "DEMO-0003");
    return makeDoc(
      {
        _id: new ObjectId(),
        opportunityNo: blueprint[0],
        name: blueprint[1],
        customerSnapshot: buildPartySnapshot(customerDoc),
        opportunityType: blueprint[3],
        stage: blueprint[4],
        ownerUserSnapshot: owner,
        expectedAwardDate: isoDate(10 + index * 9),
        expectedAmount: blueprint[5],
        currency: "KRW",
        proposals: [
          {
            revisionNo: `R${index}`,
            submittedAt: isoDate(-25 + index),
            amount: blueprint[5],
            status: blueprint[4] === "lost" ? "unsuccessful" : "submitted",
          },
        ],
        riskSummary: {
          level: index % 3 === 0 ? "high" : "medium",
          note: index % 3 === 0 ? "Owner decision pending" : "Commercial alignment in progress",
        },
        fileRefs: [],
        status: blueprint[4] === "lost" ? "lost" : "open",
      },
      -40 + index,
      10,
    );
  });

  const partyDocs: Record<string, any>[] = partyBlueprints.map((blueprint, index) =>
    makeDoc(
      {
        _id: partyIdByCode.get(blueprint.code)!,
        code: blueprint.code,
        name: blueprint.name,
        legalName: blueprint.legalName,
        partyRoles: blueprint.partyRoles,
        taxId: blueprint.taxId,
        country: blueprint.country,
        contacts: [
          {
            name: `${blueprint.name} PMO`,
            role: blueprint.partyRoles.includes("customer") ? "Project Manager" : "Sales Manager",
            email: `contact+${index + 1}@${blueprint.code.toLowerCase()}.demo`,
            phone: `+82-2-555-${String(1000 + index).padStart(4, "0")}`,
          },
        ],
        addresses: [
          {
            label: "HQ",
            line1: `${10 + index} Demo-ro`,
            city: blueprint.country === "KR" ? "Seoul" : "Singapore",
            country: blueprint.country,
          },
        ],
        bankAccounts: [
          {
            bankName: "Demo Bank",
            accountNo: `110-123-${String(1000 + index).padStart(4, "0")}`,
            currency: "KRW",
          },
        ],
        qualifications: blueprint.partyRoles.includes("vendor")
          ? [
              {
                code: "QUAL-SMR",
                label: "SMR Qualified Vendor",
                validTo: "2027-12-31",
              },
            ]
          : [],
        status: "active",
      },
      -110 + index,
      8,
    ),
  );

  const moduleDocs: Record<string, any>[] = moduleBlueprints.map((blueprint, index) => {
    const projectDoc = projects.find((item) => item.code === blueprint[1])!;
    const systemDoc = systems.find((item) => item.code === blueprint[2] && item.projectSnapshot.projectId === String(projectDoc._id))!;
    const unitDoc = units.find((item) => item._id.toString() === systemDoc.unitSnapshot.unitId)!;
    const vendorDoc = {
      _id: partyIdByCode.get(blueprint[5])!,
      ...partyBlueprints.find((item) => item.code === blueprint[5])!,
    };
    return makeDoc(
      {
        _id: moduleIdByNo.get(blueprint[0])!,
        moduleNo: blueprint[0],
        projectSnapshot: buildProjectSnapshot(projectDoc),
        unitSnapshot: {
          unitId: String(unitDoc._id),
          unitNo: unitDoc.unitNo,
        },
        systemSnapshot: buildSystemSnapshot(systemDoc),
        moduleType: blueprint[3],
        serialNo: blueprint[4],
        manufacturerSnapshot: {
          partyId: String(vendorDoc._id),
          code: vendorDoc.code,
          name: vendorDoc.name,
        },
        components: [
          {
            materialSnapshot: buildMaterialSnapshot(materials[index % materials.length]),
            quantity: index % 2 === 0 ? 1 : 2,
          },
        ],
        installationDate: blueprint[6] === "installed" ? isoDate(-14) : "",
        status: blueprint[6],
      },
      -60 + index,
      10,
    );
  });

  const manufacturingOrders: Record<string, any>[] = [
    makeDoc(
      {
        _id: new ObjectId(),
        orderNo: "MO-DEMO-ULS-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-ULSAN-1")!),
        moduleSnapshot: buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-ULS-001")!),
        vendorSnapshot: buildPartySnapshot(partyDocs.find((item) => item.code === "PTY-DEMO-VND-DOOSAN")!),
        plannedStartDate: isoDate(-20),
        plannedEndDate: isoDate(15),
        quantity: 1,
        milestones: [
          { name: "Kickoff", plannedDate: isoDate(-20), status: "done" },
          { name: "Welding", plannedDate: isoDate(-6), status: "in-progress" },
        ],
        status: "in-progress",
      },
      -20,
      10,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        orderNo: "MO-DEMO-SIN-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-SINAN-2")!),
        moduleSnapshot: buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-SIN-001")!),
        vendorSnapshot: buildPartySnapshot(partyDocs.find((item) => item.code === "PTY-DEMO-VND-DOOSAN")!),
        plannedStartDate: isoDate(-12),
        plannedEndDate: isoDate(20),
        quantity: 1,
        milestones: [
          { name: "Fabrication Start", plannedDate: isoDate(-12), status: "done" },
          { name: "Pipe Fit-up", plannedDate: isoDate(-2), status: "in-progress" },
        ],
        status: "in-progress",
      },
      -12,
      11,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        orderNo: "MO-DEMO-ULJ-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-ULJIN-1")!),
        moduleSnapshot: buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-ULJ-002")!),
        vendorSnapshot: buildPartySnapshot(partyDocs.find((item) => item.code === "PTY-DEMO-VND-HANBIT")!),
        plannedStartDate: isoDate(-35),
        plannedEndDate: isoDate(-5),
        quantity: 1,
        milestones: [
          { name: "Cabinet Wiring", plannedDate: isoDate(-28), status: "done" },
          { name: "Functional Test", plannedDate: isoDate(-7), status: "done" },
        ],
        status: "completed",
      },
      -35,
      11,
    ),
  ];

  const shipments: Record<string, any>[] = [
    makeDoc(
      {
        _id: new ObjectId(),
        shipmentNo: "SHP-DEMO-ULS-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-ULSAN-1")!),
        moduleSnapshots: [buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-ULS-003")!)],
        origin: "Ulsan Port Marshalling Yard",
        destination: "Uljin Module Yard",
        departureDate: isoDate(-7),
        arrivalDate: isoDate(1),
        logisticsStatus: "in-transit",
        customsStatus: "n/a",
        status: "active",
      },
      -7,
      12,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        shipmentNo: "SHP-DEMO-ULJ-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-ULJIN-1")!),
        moduleSnapshots: [buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-ULJ-003")!)],
        origin: "Busan Port",
        destination: "Uljin Main Site",
        departureDate: isoDate(-21),
        arrivalDate: isoDate(-12),
        logisticsStatus: "delivered",
        customsStatus: "cleared",
        status: "active",
      },
      -21,
      12,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        shipmentNo: "SHP-DEMO-SIN-001",
        projectSnapshot: buildProjectSnapshot(projects.find((item) => item.code === "PRJ-DEMO-SINAN-2")!),
        moduleSnapshots: [buildModuleSnapshot(moduleDocs.find((item) => item.moduleNo === "MOD-DEMO-SIN-003")!)],
        origin: "Incheon Port",
        destination: "Sinan Offshore Construction Base",
        departureDate: isoDate(2),
        arrivalDate: isoDate(8),
        logisticsStatus: "preparing",
        customsStatus: "pending",
        status: "active",
      },
      0,
      12,
    ),
  ];

  const purchaseOrders: Record<string, any>[] = [];
  const inventoryTransactions: Record<string, any>[] = [];

  for (const poBlueprint of purchaseOrderBlueprints) {
    const projectDoc = projects.find((item) => item.code === poBlueprint.projectCode)!;
    const [systemCode, wbsCode] = poBlueprint.wbsCode.split("/");
    const wbsDoc = wbsItems.find(
      (item) =>
        item.code === wbsCode &&
        item.systemSnapshot?.code === systemCode &&
        item.projectSnapshot.projectId === String(projectDoc._id),
    )!;
    const budgetDoc = budgets.find(
      (item) =>
        item.wbsSnapshot.wbsId === String(wbsDoc._id) &&
        item.projectSnapshot.projectId === String(projectDoc._id),
    )!;
    const vendorDoc = partyDocs.find((item) => item.code === poBlueprint.vendorCode)!;
    const lines = poBlueprint.lines.map((line, index) => {
      const materialDoc = materials.find((item) => item.materialCode === line.materialCode)!;
      const receivedQuantity = sum(
        poBlueprint.receipts.flatMap((receipt) => [
          Number((receipt.lineQuantities as Record<string, number>)[String(index + 1)] ?? 0),
        ]),
      );
      return {
        lineNo: index + 1,
        materialSnapshot: buildMaterialSnapshot(materialDoc),
        quantity: line.quantity,
        receivedQuantity,
        unitPrice: line.unitPrice,
        lineAmount: line.quantity * line.unitPrice,
      };
    });
    const receiptHistory = poBlueprint.receipts.map((receipt) => {
      const siteDoc = sites.find((item) => item.code === receipt.siteCode)!;
      const lineItems = Object.entries(receipt.lineQuantities).map(([lineNo, quantity]) => {
        const line = lines.find((candidate) => candidate.lineNo === Number(lineNo))!;
        return {
          lineNo: Number(lineNo),
          quantity,
          uom: line.materialSnapshot.uom,
          materialId: line.materialSnapshot.materialId,
          materialDescription: line.materialSnapshot.description,
        };
      });
      return {
        receiptNo: receipt.receiptNo,
        transactionDate: isoDate(receipt.transactionDate),
        storageLocation: receipt.storageLocation,
        status: "completed",
        siteSnapshot: buildSiteSnapshot(siteDoc),
        lineItems,
        createdAt: isoTimestamp(receipt.transactionDate, 13),
        createdBy: buildActorSnapshot(seedProfile),
      };
    });
    const orderedQuantity = sum(lines.map((line) => line.quantity));
    const receivedQuantity = sum(lines.map((line) => line.receivedQuantity));
    const poDoc = makeDoc(
      {
        _id: poIdByNo.get(poBlueprint.poNo)!,
        poNo: poBlueprint.poNo,
        projectSnapshot: buildProjectSnapshot(projectDoc),
        wbsSnapshot: buildWbsSnapshot(wbsDoc),
        budgetSnapshot: buildBudgetSnapshot(budgetDoc),
        vendorSnapshot: buildPartySnapshot(vendorDoc),
        orderDate: isoDate(poBlueprint.orderDate),
        dueDate: isoDate(poBlueprint.dueDate),
        currency: "KRW",
        lines,
        totalAmount: sum(lines.map((line) => line.lineAmount)),
        receiptSummary: {
          orderedQuantity,
          receivedQuantity,
          remainingQuantity: Math.max(orderedQuantity - receivedQuantity, 0),
          lastReceivedAt: receiptHistory.at(-1)?.transactionDate ?? "",
        },
        receiptHistory,
        status: poBlueprint.status,
      },
      poBlueprint.orderDate,
      11,
    );
    purchaseOrders.push(poDoc);

    for (const receipt of receiptHistory) {
      const siteDoc = sites.find((item) => String(item._id) === receipt.siteSnapshot.siteId)!;
      for (const lineItem of receipt.lineItems) {
        const materialDoc = materials.find((item) => String(item._id) === lineItem.materialId)!;
        inventoryTransactions.push(
          buildInventoryTransactionDocument(
            projectDoc,
            siteDoc,
            materialDoc,
            seedProfile,
            {
              storageLocation: receipt.storageLocation,
              transactionType: "receipt",
              quantity: lineItem.quantity,
              transactionDate: receipt.transactionDate,
              qualityStatus: "available",
              referenceSnapshot: buildReferenceSnapshot(
                "purchase_order",
                String(poDoc._id),
                receipt.receiptNo,
                poDoc.poNo,
              ),
            },
            receipt.createdAt,
          ),
        );
      }
    }
  }

  const projectByCode = new Map(projects.map((item) => [item.code, item]));
  const siteByCode = new Map(sites.map((item) => [item.code, item]));
  const systemByCode = new Map(systems.map((item) => [item.code, item]));
  const wbsByComposite = new Map(
    wbsItems.map((item) => [`${item.systemSnapshot?.code}/${item.code}`, item]),
  );
  const budgetByWbsId = new Map(budgets.map((item) => [item.wbsSnapshot.wbsId, item]));

  const extraInventorySeed = [
    {
      materialCode: "MAT-DEMO-PP-001",
      projectCode: "PRJ-DEMO-SINAN-2",
      siteCode: "SITE-SINAN-OFFSHORE",
      storageLocation: "PIPE-YARD",
      transactionType: "issue",
      quantity: 180,
      transactionDate: isoDate(-6),
      referenceSnapshot: buildReferenceSnapshot("field_issue", "SIN-FIELD-001", "ISS-DEMO-SIN-001", "Spool issuance"),
      status: "completed",
    },
    {
      materialCode: "MAT-DEMO-CBL-001",
      projectCode: "PRJ-DEMO-SINAN-2",
      siteCode: "SITE-SINAN-YARD",
      storageLocation: "CBL-01",
      transactionType: "adjustment",
      quantity: 120,
      adjustmentDirection: "increase",
      adjustmentReason: "cycle-count-found",
      transactionDate: isoDate(-3),
      referenceSnapshot: buildReferenceSnapshot("inventory_adjustment", "ADJ-SIN-001", "ADJ-DEMO-SIN-001", "Cycle count increase"),
      status: "completed",
    },
    {
      materialCode: "MAT-DEMO-CAB-001",
      projectCode: "PRJ-DEMO-ULJIN-1",
      siteCode: "SITE-ULJIN-MAIN",
      storageLocation: "I&C-01",
      transactionType: "adjustment",
      quantity: 1,
      adjustmentDirection: "decrease",
      adjustmentReason: "damaged-on-site",
      transactionDate: isoDate(-1),
      referenceSnapshot: buildReferenceSnapshot("inventory_adjustment", "ADJ-ULJ-001", "ADJ-DEMO-ULJ-001", "Damage write-off"),
      status: "pending-approval",
    },
    {
      materialCode: "MAT-DEMO-STR-001",
      projectCode: "PRJ-DEMO-ULJIN-1",
      siteCode: "SITE-ULJIN-YARD",
      storageLocation: "STRUCT-YARD",
      transactionType: "transfer",
      quantity: 6,
      targetSiteCode: "SITE-ULJIN-MAIN",
      targetStorageLocation: "STRUCT-01",
      transactionDate: isoDate(0),
      referenceSnapshot: buildReferenceSnapshot("inventory_transfer", "TRF-ULJ-001", "TRF-DEMO-ULJ-001", "Yard to main site"),
      status: "pending-approval",
    },
    {
      materialCode: "MAT-DEMO-STR-001",
      projectCode: "PRJ-DEMO-ULJIN-1",
      siteCode: "SITE-ULJIN-YARD",
      storageLocation: "STRUCT-YARD",
      transactionType: "issue",
      quantity: 4,
      transactionDate: isoDate(-8),
      referenceSnapshot: buildReferenceSnapshot("inventory_transfer", "TRF-ULJ-000", "TRF-DEMO-ULJ-000", "Historic internal transfer out"),
      status: "completed",
    },
    {
      materialCode: "MAT-DEMO-STR-001",
      projectCode: "PRJ-DEMO-ULJIN-1",
      siteCode: "SITE-ULJIN-MAIN",
      storageLocation: "STRUCT-01",
      transactionType: "receipt",
      quantity: 4,
      transactionDate: isoDate(-8),
      referenceSnapshot: buildReferenceSnapshot("inventory_transfer", "TRF-ULJ-000", "TRF-DEMO-ULJ-000", "Historic internal transfer in"),
      status: "completed",
    },
  ];

  for (const seed of extraInventorySeed) {
    const projectDoc = projectByCode.get(seed.projectCode)!;
    const siteDoc = siteByCode.get(seed.siteCode)!;
    const materialDoc = materials.find((item) => item.materialCode === seed.materialCode)!;
    inventoryTransactions.push(
      buildInventoryTransactionDocument(
        projectDoc,
        siteDoc,
        materialDoc,
        seedProfile,
        {
          storageLocation: seed.storageLocation,
          transactionType: seed.transactionType,
          quantity: seed.quantity,
          transactionDate: seed.transactionDate,
          adjustmentDirection: seed.adjustmentDirection,
          adjustmentReason: seed.adjustmentReason,
          targetSiteSnapshot: seed.targetSiteCode
            ? buildSiteSnapshot(siteByCode.get(seed.targetSiteCode)!)
            : null,
          targetStorageLocation: seed.targetStorageLocation,
          qualityStatus: "available",
          referenceSnapshot: seed.referenceSnapshot,
          status: seed.status,
        },
        isoTimestamp(-2, 14),
      ),
    );
  }

  const itps = [
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULSAN-1")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-ULS-RCS")!),
        code: "ITP-ULS-RCS-001",
        name: "Reactor Vessel Fit-up ITP",
        revisionNo: "A",
        ownerUserSnapshot: makeActor("Doyun Ahn", "QA / HSE Office", "doyun.ahn@demo.erp", "DEMO-0010"),
        approvalStatus: "approved",
        testItems: [
          { seq: 1, title: "Nozzle orientation", holdPoint: true, status: "complete" },
          { seq: 2, title: "Hydro test preparation", holdPoint: false, status: "ready" },
        ],
        status: "active",
      },
      -30,
      14,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-SINAN-2")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-SIN-PIPE")!),
        code: "ITP-SIN-PIPE-001",
        name: "Main Steam Spool Weld ITP",
        revisionNo: "B",
        ownerUserSnapshot: makeActor("Jiwon Shin", "QA / HSE Office", "jiwon.shin@demo.erp", "DEMO-0011"),
        approvalStatus: "approved",
        testItems: [
          { seq: 1, title: "WPS verification", holdPoint: false, status: "complete" },
          { seq: 2, title: "Radiography sampling", holdPoint: true, status: "planned" },
        ],
        status: "active",
      },
      -22,
      14,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-ULJ-CMS")!),
        code: "ITP-ULJ-CMS-001",
        name: "Control Room Cabinet FAT",
        revisionNo: "C",
        ownerUserSnapshot: makeActor("Doyun Ahn", "QA / HSE Office", "doyun.ahn@demo.erp", "DEMO-0010"),
        approvalStatus: "draft",
        testItems: [
          { seq: 1, title: "Loop integrity", holdPoint: false, status: "complete" },
          { seq: 2, title: "Signal simulation", holdPoint: false, status: "in-progress" },
        ],
        status: "active",
      },
      -16,
      14,
    ),
  ];

  const inspections = [
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULSAN-1")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-ULS-RCS")!),
        itpSnapshot: { itpId: String(itps[0]._id), code: itps[0].code, name: itps[0].name },
        inspectionType: "fit-up",
        inspectionDate: isoDate(-11),
        result: "pass",
        holdPoint: true,
        inspectors: ["Doyun Ahn", "Jihoon Lee"],
        documentRefs: ["DOC-ULS-RCS-001"],
        status: "completed",
      },
      -11,
      15,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-SINAN-2")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-SIN-PIPE")!),
        itpSnapshot: { itpId: String(itps[1]._id), code: itps[1].code, name: itps[1].name },
        inspectionType: "radiography",
        inspectionDate: isoDate(-4),
        result: "hold",
        holdPoint: true,
        inspectors: ["Jiwon Shin"],
        documentRefs: ["DOC-SIN-PIPE-011"],
        status: "scheduled",
      },
      -4,
      15,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-ULJ-CMS")!),
        itpSnapshot: { itpId: String(itps[2]._id), code: itps[2].code, name: itps[2].name },
        inspectionType: "functional-test",
        inspectionDate: isoDate(-2),
        result: "pass",
        holdPoint: false,
        inspectors: ["Doyun Ahn", "Eunji Kang"],
        documentRefs: ["DOC-ULJ-CMS-008"],
        status: "completed",
      },
      -2,
      15,
    ),
  ];

  const ncrs = [
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-SINAN-2")!),
        sourceSnapshot: {
          sourceType: "inspection",
          sourceId: String(inspections[1]._id),
          refNo: "INSP-SIN-002",
        },
        ncrNo: "NCR-DEMO-SIN-001",
        severity: "major",
        disposition: "rework",
        ownerUserSnapshot: makeActor("Jiwon Shin", "QA / HSE Office", "jiwon.shin@demo.erp", "DEMO-0011"),
        dueDate: isoDate(7),
        capaActions: [
          { title: "Re-weld suspect area", owner: "Taemin Oh", status: "open" },
          { title: "Repeat RT", owner: "Jiwon Shin", status: "planned" },
        ],
        status: "open",
      },
      -4,
      16,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        sourceSnapshot: {
          sourceType: "manufacturing_order",
          sourceId: String(manufacturingOrders[2]._id),
          refNo: manufacturingOrders[2].orderNo,
        },
        ncrNo: "NCR-DEMO-ULJ-001",
        severity: "minor",
        disposition: "use-as-is",
        ownerUserSnapshot: makeActor("Doyun Ahn", "QA / HSE Office", "doyun.ahn@demo.erp", "DEMO-0010"),
        dueDate: isoDate(-1),
        capaActions: [{ title: "Close with concession", owner: "Doyun Ahn", status: "done" }],
        status: "closed",
      },
      -18,
      16,
    ),
  ];

  const hseIncidents = [
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULSAN-1")!),
        siteSnapshot: buildSiteSnapshot(siteByCode.get("SITE-ULSAN-FAB")!),
        incidentNo: "HSE-DEMO-ULS-001",
        incidentType: "near-miss",
        occurredAt: isoTimestamp(-5, 4),
        severity: "medium",
        ownerUserSnapshot: makeActor("Doyun Ahn", "QA / HSE Office", "doyun.ahn@demo.erp", "DEMO-0010"),
        correctiveActions: [
          { title: "Barricade crane area", status: "done" },
          { title: "Toolbox talk refresh", status: "in-progress" },
        ],
        status: "investigating",
      },
      -5,
      17,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        siteSnapshot: buildSiteSnapshot(siteByCode.get("SITE-ULJIN-MAIN")!),
        incidentNo: "HSE-DEMO-ULJ-001",
        incidentType: "first-aid",
        occurredAt: isoTimestamp(-19, 2),
        severity: "low",
        ownerUserSnapshot: makeActor("Jiwon Shin", "QA / HSE Office", "jiwon.shin@demo.erp", "DEMO-0011"),
        correctiveActions: [{ title: "Closeout review", status: "done" }],
        status: "closed",
      },
      -19,
      17,
    ),
  ];

  const apInvoices: Record<string, any>[] = [];
  const arInvoices: Record<string, any>[] = [];
  const journalEntries: Record<string, any>[] = [];

  function makeJournalLines(entries: Array<[string, number, number, string]>) {
    return entries.map(([accountCode, debit, credit, memo], index) => {
      const account = accountByCode.get(accountCode)!;
      return {
        lineNo: index + 1,
        accountCode: account.accountCode,
        accountName: account.accountName,
        debit,
        credit,
        memo,
      };
    });
  }

  const apBlueprints = [
    {
      invoiceNo: "AP-DEMO-ULS-001",
      poNo: "PO-DEMO-ULS-001",
      invoiceDate: -25,
      dueDate: -5,
      supplyAmount: 4740000000,
      taxAmount: 474000000,
      status: "paid",
      paymentHistory: [
        { paymentDate: isoDate(-3), amount: 5214000000, method: "bank-transfer", note: "Final payment" },
      ],
    },
    {
      invoiceNo: "AP-DEMO-ULS-002",
      poNo: "PO-DEMO-ULS-002",
      invoiceDate: -8,
      dueDate: 12,
      supplyAmount: 768000000,
      taxAmount: 76800000,
      status: "partial-paid",
      paymentHistory: [
        { paymentDate: isoDate(-2), amount: 300000000, method: "bank-transfer", note: "Advance payment" },
      ],
    },
    {
      invoiceNo: "AP-DEMO-SIN-001",
      poNo: "PO-DEMO-SIN-001",
      invoiceDate: -15,
      dueDate: -1,
      supplyAmount: 2732000000,
      taxAmount: 273200000,
      status: "overdue",
      paymentHistory: [],
    },
    {
      invoiceNo: "AP-DEMO-ULJ-001",
      poNo: "PO-DEMO-ULJ-001",
      invoiceDate: -52,
      dueDate: -20,
      supplyAmount: 4405200000,
      taxAmount: 440520000,
      status: "approved",
      paymentHistory: [],
    },
    {
      invoiceNo: "AP-DEMO-ULJ-002",
      poNo: "PO-DEMO-ULJ-002",
      invoiceDate: -7,
      dueDate: 18,
      supplyAmount: 595000000,
      taxAmount: 59500000,
      status: "pending",
      paymentHistory: [],
    },
  ];

  for (const blueprint of apBlueprints) {
    const poDoc = purchaseOrders.find((item) => item.poNo === blueprint.poNo)!;
    const accountingUnitSnapshot = buildAccountingUnitSnapshot(accountingUnit);
    const periodSnapshot = buildPeriodSnapshot(openPeriod);
    const apId = new ObjectId();
    const totalAmount = blueprint.supplyAmount + blueprint.taxAmount;
    const paymentHistory = blueprint.paymentHistory.map((item) => ({
      paymentId: new ObjectId().toString(),
      paymentDate: item.paymentDate,
      amount: item.amount,
      method: item.method,
      note: item.note,
      createdAt: `${item.paymentDate}T09:00:00.000Z`,
      createdBy: makeActor("Eunji Kang", "Finance Control Tower", "eunji.kang@demo.erp", "DEMO-0012"),
    }));
    const paymentSummary = buildApPaymentSummary({
      totalAmount,
      paymentHistory,
      status: blueprint.status,
      paymentSummary: {
        paidAmount: paymentHistory.reduce((total, item) => total + item.amount, 0),
        remainingAmount: totalAmount,
        lastPaidAt: paymentHistory.at(-1)?.paymentDate ?? "",
        lastPaymentMethod: paymentHistory.at(-1)?.method ?? "",
      },
    });
    let journalEntrySnapshot = null;
    if (blueprint.status !== "pending") {
      const voucherNo = `JV-AP-${blueprint.invoiceNo.slice(-3)}`;
      const journalId = new ObjectId();
      journalEntrySnapshot = {
        journalEntryId: journalId.toString(),
        voucherNo,
        status: blueprint.status === "paid" ? "posted" : "draft",
      };
      journalEntries.push(
        makeDoc(
          {
            _id: journalId,
            accountingUnitSnapshot,
            periodSnapshot,
            voucherNo,
            journalType: "general",
            journalDate: isoDate(blueprint.invoiceDate),
            description: `AP 승인 전표 · ${blueprint.invoiceNo}`,
            originType: "ap",
            sourceSnapshot: {
              sourceType: "ap_invoice",
              sourceId: apId.toString(),
              refNo: blueprint.invoiceNo,
            },
            vendorSnapshot: poDoc.vendorSnapshot,
            projectSnapshot: poDoc.projectSnapshot,
            wbsSnapshot: poDoc.wbsSnapshot,
            budgetSnapshot: poDoc.budgetSnapshot,
            lines: makeJournalLines([
              ["510000", totalAmount, 0, "Materials expense"],
              ["211000", 0, totalAmount, "Trade payables"],
            ]),
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            postedAt: blueprint.status === "paid" ? isoTimestamp(-2, 8) : "",
            status: blueprint.status === "paid" ? "posted" : "draft",
          },
          blueprint.invoiceDate,
          9,
        ),
      );
    }

    apInvoices.push(
      makeDoc(
        {
          _id: apId,
          vendorSnapshot: poDoc.vendorSnapshot,
          projectSnapshot: poDoc.projectSnapshot,
          wbsSnapshot: poDoc.wbsSnapshot,
          budgetSnapshot: poDoc.budgetSnapshot,
          accountingUnitSnapshot,
          invoiceNo: blueprint.invoiceNo,
          invoiceDate: isoDate(blueprint.invoiceDate),
          dueDate: isoDate(blueprint.dueDate),
          currency: "KRW",
          supplyAmount: blueprint.supplyAmount,
          taxAmount: blueprint.taxAmount,
          totalAmount,
          matchedPurchaseOrders: [{ purchaseOrderId: String(poDoc._id), poNo: poDoc.poNo }],
          sourceSnapshot: {
            sourceType: "purchase_order",
            sourceId: String(poDoc._id),
            refNo: poDoc.poNo,
          },
          paymentHistory,
          paymentSummary: {
            ...paymentSummary,
            paidAt: paymentSummary.lastPaidAt,
          },
          journalEntrySnapshot,
          status: blueprint.status,
        },
        blueprint.invoiceDate,
        10,
      ),
    );
  }

  const arBlueprints = [
    {
      invoiceNo: "AR-DEMO-ULS-001",
      contractNo: "CTR-DEMO-ULSAN-001",
      invoiceDate: -12,
      dueDate: 5,
      supplyAmount: 8200000000,
      taxAmount: 820000000,
      status: "partial-received",
      collections: [{ collectionDate: isoDate(-1), amount: 3000000000, method: "bank-transfer", note: "Milestone A" }],
    },
    {
      invoiceNo: "AR-DEMO-SIN-001",
      contractNo: "CTR-DEMO-SINAN-001",
      invoiceDate: -9,
      dueDate: 2,
      supplyAmount: 4400000000,
      taxAmount: 440000000,
      status: "issued",
      collections: [],
    },
    {
      invoiceNo: "AR-DEMO-ULJ-001",
      contractNo: "CTR-DEMO-ULJIN-001",
      invoiceDate: -25,
      dueDate: -5,
      supplyAmount: 12500000000,
      taxAmount: 1250000000,
      status: "received",
      collections: [{ collectionDate: isoDate(-3), amount: 13750000000, method: "bank-transfer", note: "Turnover settlement" }],
    },
    {
      invoiceNo: "AR-DEMO-BUS-001",
      contractNo: "CTR-DEMO-BUSAN-001",
      invoiceDate: -2,
      dueDate: 15,
      supplyAmount: 420000000,
      taxAmount: 42000000,
      status: "draft",
      collections: [],
    },
    {
      invoiceNo: "AR-DEMO-ULJ-002",
      contractNo: "CTR-DEMO-ULJIN-001",
      invoiceDate: -40,
      dueDate: -15,
      supplyAmount: 3800000000,
      taxAmount: 380000000,
      status: "overdue",
      collections: [],
    },
  ];

  for (const blueprint of arBlueprints) {
    const contractDoc = contracts.find((item) => item.contractNo === blueprint.contractNo)!;
    const accountingUnitSnapshot = buildAccountingUnitSnapshot(accountingUnit);
    const periodSnapshot = buildPeriodSnapshot(openPeriod);
    const arId = new ObjectId();
    const totalAmount = blueprint.supplyAmount + blueprint.taxAmount;
    const createdActor = makeActor("Minseo Park", "Business Development Office", "minseo.park@demo.erp", "DEMO-0002");
    let issueJournalEntrySnapshot = null;
    if (blueprint.status !== "draft") {
      const journalId = new ObjectId();
      const voucherNo = `JV-AR-${blueprint.invoiceNo.slice(-3)}`;
      issueJournalEntrySnapshot = buildArJournalEntrySnapshot(
        journalId.toString(),
        voucherNo,
        blueprint.status === "received" ? "posted" : "draft",
      );
      journalEntries.push(
        makeDoc(
          {
            _id: journalId,
            accountingUnitSnapshot,
            periodSnapshot,
            voucherNo,
            journalType: "general",
            journalDate: isoDate(blueprint.invoiceDate),
            description: `AR 발행 전표 · ${blueprint.invoiceNo}`,
            originType: "ar",
            sourceSnapshot: {
              sourceType: "ar_invoice",
              sourceId: arId.toString(),
              refNo: blueprint.invoiceNo,
              eventType: "issue",
            },
            customerSnapshot: contractDoc.customerSnapshot,
            projectSnapshot: contractDoc.projectSnapshot,
            contractSnapshot: buildContractSnapshot(contractDoc),
            lines: makeJournalLines([
              ["121000", totalAmount, 0, "Trade receivables"],
              ["410000", 0, totalAmount, "Engineering revenue"],
            ]),
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            postedAt: blueprint.status === "received" ? isoTimestamp(-2, 8) : "",
            status: blueprint.status === "received" ? "posted" : "draft",
          },
          blueprint.invoiceDate,
          10,
        ),
      );
    }

    const collectionHistory = blueprint.collections.map((item, index) => {
      const collectionJournalId = new ObjectId();
      const collectionVoucherNo = `JV-ARC-${blueprint.invoiceNo.slice(-3)}-${index + 1}`;
      journalEntries.push(
        makeDoc(
          {
            _id: collectionJournalId,
            accountingUnitSnapshot,
            periodSnapshot,
            voucherNo: collectionVoucherNo,
            journalType: "general",
            journalDate: item.collectionDate,
            description: `AR 수금 전표 · ${blueprint.invoiceNo}`,
            originType: "ar",
            sourceSnapshot: {
              sourceType: "ar_invoice",
              sourceId: arId.toString(),
              refNo: blueprint.invoiceNo,
              eventType: "collection",
              collectionId: `COLL-${blueprint.invoiceNo}-${index + 1}`,
            },
            customerSnapshot: contractDoc.customerSnapshot,
            projectSnapshot: contractDoc.projectSnapshot,
            contractSnapshot: buildContractSnapshot(contractDoc),
            lines: makeJournalLines([
              ["111000", item.amount, 0, "Cash receipt"],
              ["121000", 0, item.amount, "Trade receivables"],
            ]),
            totalDebit: item.amount,
            totalCredit: item.amount,
            postedAt: blueprint.status === "received" ? `${item.collectionDate}T09:00:00.000Z` : "",
            status: blueprint.status === "received" ? "posted" : "draft",
          },
          blueprint.invoiceDate,
          11,
        ),
      );
      return {
        collectionId: `COLL-${blueprint.invoiceNo}-${index + 1}`,
        collectionDate: item.collectionDate,
        amount: item.amount,
        method: item.method,
        note: item.note,
        createdAt: `${item.collectionDate}T09:00:00.000Z`,
        createdBy: makeActor("Eunji Kang", "Finance Control Tower", "eunji.kang@demo.erp", "DEMO-0012"),
        journalEntrySnapshot: buildArJournalEntrySnapshot(
          collectionJournalId.toString(),
          collectionVoucherNo,
          blueprint.status === "received" ? "posted" : "draft",
        ),
      };
    });
    const collectionSummary = buildArCollectionSummary({
      totalAmount,
      collectionHistory,
      status: blueprint.status,
      collectionSummary: {
        receivedAmount: collectionHistory.reduce((total, item) => total + item.amount, 0),
        remainingAmount: totalAmount,
        lastReceivedAt: collectionHistory.at(-1)?.collectionDate ?? "",
        lastCollectionMethod: collectionHistory.at(-1)?.method ?? "",
      },
    });

    arInvoices.push(
      makeDoc(
        {
          _id: arId,
          customerSnapshot: contractDoc.customerSnapshot,
          projectSnapshot: contractDoc.projectSnapshot,
          contractSnapshot: buildContractSnapshot(contractDoc),
          accountingUnitSnapshot,
          invoiceNo: blueprint.invoiceNo,
          invoiceDate: isoDate(blueprint.invoiceDate),
          dueDate: isoDate(blueprint.dueDate),
          currency: "KRW",
          supplyAmount: blueprint.supplyAmount,
          taxAmount: blueprint.taxAmount,
          totalAmount,
          issueJournalEntrySnapshot,
          collectionHistory,
          collectionSummary: {
            ...collectionSummary,
            receivedAt: collectionSummary.lastReceivedAt,
          },
          changeHistory: [
            createChangeEntry({
              type: "ar.created",
              title: "AR 등록",
              description: "AR 문서가 생성되었습니다.",
              occurredAt: isoTimestamp(blueprint.invoiceDate, 8),
              actor: createdActor,
            }),
          ],
          status: blueprint.status,
        },
        blueprint.invoiceDate,
        10,
      ),
    );
  }

  const manualJournalBlueprints = [
    {
      voucherNo: "JV-MAN-001",
      description: "Month-end freight accrual",
      journalDate: isoDate(-1),
      projectCode: "PRJ-DEMO-SINAN-2",
      wbsKey: "SYS-SIN-CBL/WBS-006",
      totalAmount: 160000000,
      status: "submitted",
    },
    {
      voucherNo: "JV-MAN-002",
      description: "Quality concession cost recognition",
      journalDate: isoDate(-6),
      projectCode: "PRJ-DEMO-ULJIN-1",
      wbsKey: "SYS-ULJ-CMS/WBS-004",
      totalAmount: 95000000,
      status: "posted",
    },
    {
      voucherNo: "JV-MAN-003",
      description: "Temporary facility depreciation bridge",
      journalDate: isoDate(-12),
      projectCode: "PRJ-DEMO-ULSAN-1",
      wbsKey: "SYS-ULS-STR/WBS-006",
      totalAmount: 58000000,
      status: "reversed",
    },
  ];

  for (const blueprint of manualJournalBlueprints) {
    const projectDoc = projectByCode.get(blueprint.projectCode)!;
    const wbsDoc = wbsByComposite.get(blueprint.wbsKey)!;
    const budgetDoc = budgetByWbsId.get(String(wbsDoc._id))!;
    journalEntries.push(
      makeDoc(
        {
          _id: new ObjectId(),
          accountingUnitSnapshot: buildAccountingUnitSnapshot(accountingUnit),
          periodSnapshot: buildPeriodSnapshot(openPeriod),
          voucherNo: blueprint.voucherNo,
          journalType: "general",
          journalDate: blueprint.journalDate,
          description: blueprint.description,
          originType: "manual",
          sourceSnapshot: {
            sourceType: "manual_entry",
            sourceId: blueprint.voucherNo,
            refNo: blueprint.voucherNo,
          },
          projectSnapshot: buildProjectSnapshot(projectDoc),
          wbsSnapshot: buildWbsSnapshot(wbsDoc),
          budgetSnapshot: buildBudgetSnapshot(budgetDoc),
          lines: makeJournalLines([
            ["530000", blueprint.totalAmount, 0, "Expense recognition"],
            ["211000", 0, blueprint.totalAmount, "Accrued payable"],
          ]),
          totalDebit: blueprint.totalAmount,
          totalCredit: blueprint.totalAmount,
          postedAt: blueprint.status === "posted" ? `${blueprint.journalDate}T09:00:00.000Z` : "",
          status: blueprint.status,
        },
        -5,
        13,
      ),
    );
  }

  const fixedAssets: Record<string, any>[] = [
    {
      assetNo: "FA-DEMO-ULS-001",
      projectCode: "PRJ-DEMO-ULSAN-1",
      assetClass: "plant-equipment",
      location: "Ulsan Fabrication Yard / Bay 4",
      acquisitionDate: "2025-11-01",
      acquisitionCost: 2100000000,
      usefulLifeMonths: 84,
      depreciationMethod: "straight-line",
      status: "active",
    },
    {
      assetNo: "FA-DEMO-SIN-001",
      projectCode: "PRJ-DEMO-SINAN-2",
      assetClass: "marine-support",
      location: "Sinan Offshore Construction Base / Marine Deck",
      acquisitionDate: "2025-09-01",
      acquisitionCost: 980000000,
      usefulLifeMonths: 60,
      depreciationMethod: "declining-balance",
      status: "active",
    },
    {
      assetNo: "FA-DEMO-BUS-001",
      projectCode: "PRJ-DEMO-BUSAN-3",
      assetClass: "testing-equipment",
      location: "Busan Pilot Facility / Test Bay",
      acquisitionDate: "2026-02-01",
      acquisitionCost: 420000000,
      usefulLifeMonths: 36,
      depreciationMethod: "units-of-production",
      status: "active",
    },
    {
      assetNo: "FA-DEMO-ULJ-001",
      projectCode: "PRJ-DEMO-ULJIN-1",
      assetClass: "plant-equipment",
      location: "Uljin Main Site / Turbine Hall",
      acquisitionDate: "2024-12-01",
      acquisitionCost: 3150000000,
      usefulLifeMonths: 96,
      depreciationMethod: "straight-line",
      status: "active",
    },
  ].map((blueprint, index) => {
    const projectDoc = projectByCode.get(blueprint.projectCode)!;
    const depreciationState = buildFixedAssetDepreciationState({
      acquisitionDate: blueprint.acquisitionDate,
      acquisitionCost: blueprint.acquisitionCost,
      usefulLifeMonths: blueprint.usefulLifeMonths,
      depreciationMethod: blueprint.depreciationMethod,
      asOfDate: BASE_TIME,
    });
    return makeDoc(
      {
        _id: new ObjectId(),
        assetNo: blueprint.assetNo,
        assetClass: blueprint.assetClass,
        projectSnapshot: buildProjectSnapshot(projectDoc),
        location: blueprint.location,
        acquisitionDate: blueprint.acquisitionDate,
        acquisitionCost: blueprint.acquisitionCost,
        usefulLifeMonths: blueprint.usefulLifeMonths,
        depreciationMethod: blueprint.depreciationMethod,
        depreciationSchedule: depreciationState.depreciationSchedule,
        ledgerSummary: depreciationState.ledgerSummary,
        status: blueprint.status,
      },
      -90 + index,
      8,
    );
  });

  const commissioningPackages: Record<string, any>[] = [
    makeDoc(
      {
        _id: new ObjectId(),
        packageNo: "CP-DEMO-ULJ-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        unitSnapshot: { unitId: units.find((item) => item.unitNo === "U1" && item.projectSnapshot.projectId === String(projectByCode.get("PRJ-DEMO-ULJIN-1")!._id))!._id.toString(), unitNo: "U1" },
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-ULJ-RCS")!),
        subsystemName: "Primary Loop Package",
        testItems: [{ title: "Hydro test", status: "complete" }, { title: "Leak test", status: "complete" }],
        punchItems: [],
        turnover: { dossierNo: "TO-ULJ-001", status: "ready" },
        handoverDate: isoDate(15),
        status: "mc-complete",
      },
      -14,
      14,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        packageNo: "CP-DEMO-SIN-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-SINAN-2")!),
        unitSnapshot: { unitId: units.find((item) => item.unitNo === "A1" && item.projectSnapshot.projectId === String(projectByCode.get("PRJ-DEMO-SINAN-2")!._id))!._id.toString(), unitNo: "A1" },
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-SIN-PIPE")!),
        subsystemName: "Main Steam Package",
        testItems: [{ title: "Flushing", status: "in-progress" }, { title: "Pressure hold", status: "planned" }],
        punchItems: [{ title: "Valve tag missing", severity: "minor", status: "open" }],
        turnover: { dossierNo: "TO-SIN-001", status: "draft" },
        handoverDate: "",
        status: "in-progress",
      },
      -6,
      14,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        packageNo: "CP-DEMO-BUS-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-BUSAN-3")!),
        unitSnapshot: { unitId: units.find((item) => item.unitNo === "P1" && item.projectSnapshot.projectId === String(projectByCode.get("PRJ-DEMO-BUSAN-3")!._id))!._id.toString(), unitNo: "P1" },
        systemSnapshot: buildSystemSnapshot(systemByCode.get("SYS-BUS-LAB")!),
        subsystemName: "Pilot Demonstration Package",
        testItems: [{ title: "Cold functional test", status: "planned" }],
        punchItems: [],
        turnover: { dossierNo: "TO-BUS-001", status: "draft" },
        handoverDate: "",
        status: "planned",
      },
      -1,
      14,
    ),
  ];

  const regulatoryActions: Record<string, any>[] = [
    makeDoc(
      {
        _id: new ObjectId(),
        actionNo: "REG-DEMO-ULJ-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULJIN-1")!),
        regulator: "KINS",
        actionType: "submission",
        subject: "Cold Hydro Test Completion Report",
        dueDate: isoDate(9),
        ownerUserSnapshot: makeActor("Taeyang Jung", "Commissioning Services", "taeyang.jung@demo.erp", "DEMO-0013"),
        relatedDocumentRefs: ["DOC-ULJ-RCS-HT-001"],
        responseDate: "",
        status: "open",
      },
      -3,
      15,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        actionNo: "REG-DEMO-SIN-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-SINAN-2")!),
        regulator: "Marine Safety Authority",
        actionType: "inspection",
        subject: "Offshore lifting arrangement review",
        dueDate: isoDate(4),
        ownerUserSnapshot: makeActor("Taeyang Jung", "Commissioning Services", "taeyang.jung@demo.erp", "DEMO-0013"),
        relatedDocumentRefs: ["DOC-SIN-LIFT-002"],
        responseDate: "",
        status: "open",
      },
      -5,
      15,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        actionNo: "REG-DEMO-ULS-001",
        projectSnapshot: buildProjectSnapshot(projectByCode.get("PRJ-DEMO-ULSAN-1")!),
        regulator: "MOIS",
        actionType: "closure",
        subject: "Port marshalling permit closeout",
        dueDate: isoDate(-12),
        ownerUserSnapshot: makeActor("Taeyang Jung", "Commissioning Services", "taeyang.jung@demo.erp", "DEMO-0013"),
        relatedDocumentRefs: ["DOC-ULS-PORT-011"],
        responseDate: isoDate(-8),
        status: "closed",
      },
      -20,
      15,
    ),
  ];

  const userDocs = userBlueprints.map((blueprint, index) => {
    const orgName = orgNameByCode.get(blueprint.orgCode)!;
    const roleName = roleNameByCode.get(blueprint.roleCode)!;
    const defaultProject = projectByCode.get(blueprint.defaultProjectCode);
    const projectAssignments = blueprint.projectCodes
      .map((code) => projectByCode.get(code))
      .filter((project): project is Record<string, any> => Boolean(project))
      .map((project) => ({
        projectId: String(project._id),
        siteIds: sites
          .filter((site) => site.projectSnapshot.projectId === String(project._id))
          .map((site) => String(site._id))
          .slice(0, 2),
      }));

    return makeDoc(
      {
        _id: userIdByEmail.get(blueprint.email)!,
        name: blueprint.name,
        displayName: blueprint.name,
        email: blueprint.email,
        employeeNo: blueprint.employeeNo,
        orgUnitCode: blueprint.orgCode,
        orgUnitName: orgName,
        roleCode: blueprint.roleCode,
        roleName,
        provider: "google",
        state: "활성",
        lastSeenAt: isoTimestamp(-index, 8),
        defaultProjectId: defaultProject ? String(defaultProject._id) : "",
        projectAssignments,
      },
      -30 + index,
      7,
    );
  });

  const roleMemberCount = new Map<string, number>();
  for (const userDoc of userDocs) {
    roleMemberCount.set(userDoc.roleCode, (roleMemberCount.get(userDoc.roleCode) ?? 0) + 1);
  }
  const orgMemberCount = new Map<string, number>();
  for (const userDoc of userDocs) {
    orgMemberCount.set(userDoc.orgUnitCode, (orgMemberCount.get(userDoc.orgUnitCode) ?? 0) + 1);
  }

  const roles = roleBlueprints.map((blueprint, index) =>
    makeDoc(
      {
        _id: roleIdByCode.get(blueprint.code)!,
        code: blueprint.code,
        name: blueprint.name,
        scope: blueprint.scope,
        permissions: blueprint.permissions,
        memberCount: roleMemberCount.get(blueprint.code) ?? 0,
        state: "활성",
      },
      -60 + index,
      7,
    ),
  );

  const orgUnits = orgBlueprints.map((blueprint, index) => {
    const leadUser = userBlueprints.find((item) => item.email === blueprint.leadEmail)!;
    return makeDoc(
      {
        _id: orgIdByCode.get(blueprint.code)!,
        code: blueprint.code,
        name: blueprint.name,
        category: blueprint.category,
        leadName: leadUser.name,
        leadUserId: String(userIdByEmail.get(blueprint.leadEmail)!),
        leadEmail: blueprint.leadEmail,
        memberCount: orgMemberCount.get(blueprint.code) ?? 0,
        state: "활성",
      },
      -70 + index,
      7,
    );
  });

  const policies = [
    makeDoc(
      {
        _id: new ObjectId(),
        code: "POL-DEMO-PROJ-001",
        name: "Demo Project Access by Assignment",
        target: "project",
        ruleSummary: "Users can read assigned projects and current default project by projectAssignments.",
        state: "활성",
      },
      -55,
      7,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        code: "POL-DEMO-FIN-001",
        name: "Demo Finance Posting Control",
        target: "journal-entry",
        ruleSummary: "Only finance lead can post and reverse journal entries.",
        state: "활성",
      },
      -54,
      7,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        code: "POL-DEMO-COLLAB-001",
        name: "Demo Workspace Publish Review",
        target: "workspace",
        ruleSummary: "Posts must pass review before publishing.",
        state: "활성",
      },
      -53,
      7,
    ),
  ];

  const auditLogs = [
    makeDoc(
      {
        _id: new ObjectId(),
        eventCode: "admin.user.seed",
        actor: "ERP Demo Seeder",
        resource: "users",
        route: "/scripts/seed-demo-environment",
        ipAddress: "127.0.0.1",
        occurredAt: isoTimestamp(0, 6),
        result: "success",
        roles: ["platform_admin"],
      },
      0,
      6,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        eventCode: "workspace.publish",
        actor: "Minseo Park",
        resource: "workspacePosts",
        route: "/workspace",
        ipAddress: "10.10.1.15",
        occurredAt: isoTimestamp(-1, 5),
        result: "success",
        roles: ["platform_admin", "domain_lead"],
      },
      -1,
      5,
    ),
  ];

  const workspacePosts: Record<string, any>[] = [
    {
      _id: new ObjectId(),
      title: "[공지] 3월 실적 마감 일정 공유",
      owner: "Finance Control Tower",
      updatedAt: isoTimestamp(-1, 6),
      status: "게시중",
      kind: "notice",
      roles: ["platform_admin", "domain_lead", "executive"] as AppRole[],
      linkedMenuHref: "/finance/journal-entries",
      linkedMenuLabel: "전표",
      linkedPermission: "finance.read",
      documentRef: "DOC-NOTICE-2026-0319",
      versionLabel: "v1.2",
      publishedAt: isoTimestamp(-1, 6),
      versionHistory: [
        { id: new ObjectId().toString(), versionLabel: "v1.0", changedAt: isoTimestamp(-5, 3), changedBy: "Minseo Park", team: "Business Development Office", changeType: "create" },
        { id: new ObjectId().toString(), versionLabel: "v1.1", changedAt: isoTimestamp(-2, 4), changedBy: "Hana Choi", team: "Platform Headquarters", changeType: "edit" },
        { id: new ObjectId().toString(), versionLabel: "v1.2", changedAt: isoTimestamp(-1, 6), changedBy: "Hana Choi", team: "Platform Headquarters", changeType: "publish" },
      ],
      accessHistory: [
        { id: new ObjectId().toString(), action: "view", actor: "Eunji Kang", team: "Finance Control Tower", occurredAt: isoTimestamp(-1, 7) },
        { id: new ObjectId().toString(), action: "view", actor: "Seorin Cho", team: "Platform Headquarters", occurredAt: isoTimestamp(0, 1) },
      ],
    },
    {
      _id: new ObjectId(),
      title: "[자료실] Uljin RCS Turnover Checklist",
      owner: "Commissioning Services",
      updatedAt: isoTimestamp(-2, 5),
      status: "게시중",
      kind: "library",
      roles: ["platform_admin", "domain_lead", "executive"] as AppRole[],
      linkedMenuHref: "/commissioning/packages",
      linkedMenuLabel: "시운전 패키지",
      linkedPermission: "commissioning.read",
      documentRef: "DOC-LIB-ULJ-TO-001",
      versionLabel: "v1.1",
      publishedAt: isoTimestamp(-2, 5),
      versionHistory: [
        { id: new ObjectId().toString(), versionLabel: "v1.0", changedAt: isoTimestamp(-7, 3), changedBy: "Taeyang Jung", team: "Commissioning Services", changeType: "create" },
        { id: new ObjectId().toString(), versionLabel: "v1.1", changedAt: isoTimestamp(-2, 5), changedBy: "Hana Choi", team: "Platform Headquarters", changeType: "publish" },
      ],
      accessHistory: [
        { id: new ObjectId().toString(), action: "view", actor: "Taeyang Jung", team: "Commissioning Services", occurredAt: isoTimestamp(-1, 1) },
        { id: new ObjectId().toString(), action: "ref-copy", actor: "Doyun Ahn", team: "QA / HSE Office", occurredAt: isoTimestamp(0, 2) },
      ],
    },
    {
      _id: new ObjectId(),
      title: "[자료실] Sinan Cable Routing Inspection Pack",
      owner: "QA / HSE Office",
      updatedAt: isoTimestamp(-1, 10),
      status: "검토중",
      kind: "library",
      roles: ["platform_admin", "domain_lead"] as AppRole[],
      linkedMenuHref: "/quality/inspections",
      linkedMenuLabel: "검사",
      linkedPermission: "quality.read",
      documentRef: "DOC-LIB-SIN-QA-004",
      versionLabel: "v1.0",
      publishedAt: null,
      versionHistory: [
        { id: new ObjectId().toString(), versionLabel: "v1.0", changedAt: isoTimestamp(-1, 10), changedBy: "Jiwon Shin", team: "QA / HSE Office", changeType: "create" },
      ],
      accessHistory: [],
    },
    {
      _id: new ObjectId(),
      title: "[공지] Busan Pilot Demo Visitor Control",
      owner: "QA / HSE Office",
      updatedAt: isoTimestamp(0, 7),
      status: "초안",
      kind: "notice",
      roles: ["platform_admin", "domain_lead"] as AppRole[],
      linkedMenuHref: "/safety/hse",
      linkedMenuLabel: "HSE",
      linkedPermission: "safety.read",
      documentRef: "DOC-NOTICE-BUS-001",
      versionLabel: "v1.0",
      publishedAt: null,
      versionHistory: [
        { id: new ObjectId().toString(), versionLabel: "v1.0", changedAt: isoTimestamp(0, 7), changedBy: "Doyun Ahn", team: "QA / HSE Office", changeType: "create" },
      ],
      accessHistory: [],
    },
    {
      _id: new ObjectId(),
      title: "[자료실] Archived Legacy Port Permit Pack",
      owner: "Platform Headquarters",
      updatedAt: isoTimestamp(-20, 4),
      status: "보관",
      kind: "library",
      roles: ["platform_admin"] as AppRole[],
      linkedMenuHref: "/workspace",
      linkedMenuLabel: "자료실",
      linkedPermission: "workspace.read",
      documentRef: "DOC-LIB-ARCH-001",
      archivedFromStatus: "게시중",
      versionLabel: "v2.0",
      publishedAt: isoTimestamp(-30, 4),
      versionHistory: [
        { id: new ObjectId().toString(), versionLabel: "v1.0", changedAt: isoTimestamp(-40, 4), changedBy: "Hana Choi", team: "Platform Headquarters", changeType: "create" },
        { id: new ObjectId().toString(), versionLabel: "v2.0", changedAt: isoTimestamp(-20, 4), changedBy: "Hana Choi", team: "Platform Headquarters", changeType: "restore" },
      ],
      accessHistory: [{ id: new ObjectId().toString(), action: "view", actor: "Hana Choi", team: "Platform Headquarters", occurredAt: isoTimestamp(-20, 5) }],
    },
  ].map((post, index) =>
    makeDoc(
      {
        ...post,
        id: post._id.toString(),
        href: `/workspace/${post.kind}/${post._id.toString()}`,
      },
      -10 + index,
      6,
    ),
  );

  const approvalTasks: Record<string, any>[] = workspacePosts
    .filter((post) => post.status === "검토중")
    .map((post, index) =>
      makeDoc(
        {
          _id: new ObjectId(),
          id: `TASK-${post._id.toString()}`,
          title: `${post.kind === "library" ? "자료실" : "공지"} 게시 승인 · ${post.title}`,
          owner: post.owner,
          updatedAt: post.updatedAt,
          status: "대기",
          href: post.href,
          roles: ["platform_admin", "domain_lead"],
          resourceType: "workspace_post",
          resourceId: post._id.toString(),
          resourceKind: post.kind,
          documentRef: post.documentRef,
          versionLabel: post.versionLabel,
        },
        -1 + index,
        7,
      ),
    );

  const approvalHistory: Record<string, any>[] = [
    makeDoc(
      {
        _id: new ObjectId(),
        id: "HIST-DEMO-001",
        action: "게시 승인",
        target: "[공지] 3월 실적 마감 일정 공유",
        actor: "Hana Choi",
        team: "Platform Headquarters",
        occurredAt: isoTimestamp(-1, 6),
        result: "승인",
        href: workspacePosts[0].href,
        roles: ["platform_admin", "domain_lead", "executive"],
        resourceType: "workspace_post",
        resourceId: workspacePosts[0]._id.toString(),
        resourceKind: "notice",
        documentRef: workspacePosts[0].documentRef,
        versionLabel: workspacePosts[0].versionLabel,
      },
      -1,
      6,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        id: "HIST-DEMO-002",
        action: "검토 반려",
        target: "[자료실] Cable Routing Method Statement",
        actor: "Hana Choi",
        team: "Platform Headquarters",
        occurredAt: isoTimestamp(-3, 5),
        result: "반려",
        href: "/workspace/library/rejected-demo",
        roles: ["platform_admin", "domain_lead"],
        resourceType: "workspace_post",
        resourceId: "rejected-demo",
        resourceKind: "library",
        documentRef: "DOC-LIB-SIN-OLD-001",
        versionLabel: "v0.9",
        reason: "Review notes incomplete",
      },
      -3,
      5,
    ),
  ];

  const savedViews = [
    makeDoc(
      {
        _id: new ObjectId(),
        id: "SV-DEMO-001",
        title: "PMO Portfolio Monitor",
        href: "/projects",
        description: "Active projects with budget and PO status",
        roles: ["domain_lead"],
      },
      -2,
      6,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        id: "SV-DEMO-002",
        title: "Finance Closing Board",
        href: "/finance/journal-entries",
        description: "Draft, submitted and overdue finance items",
        ownerEmail: "eunji.kang@demo.erp",
      },
      -2,
      6,
    ),
  ];

  const notifications = [
    makeDoc(
      {
        _id: new ObjectId(),
        id: "NTF-DEMO-001",
        title: "재고 조정 승인 대기",
        body: "Uljin Main Site 조정 요청 1건이 승인 대기 중입니다.",
        tone: "warning",
        ownerEmail: "jihoon.lee@demo.erp",
      },
      -1,
      8,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        id: "NTF-DEMO-002",
        title: "AR 수금 등록 완료",
        body: "Ulsan milestone 수금 30억이 반영되었습니다.",
        tone: "success",
        roles: ["platform_admin", "domain_lead"],
      },
      -1,
      8,
    ),
    makeDoc(
      {
        _id: new ObjectId(),
        id: "NTF-DEMO-003",
        title: "회의 기간 2026-03 오픈",
        body: "3월 회계기간이 오픈 상태입니다.",
        tone: "info",
        roles: ["platform_admin", "domain_lead", "executive"],
      },
      -1,
      8,
    ),
  ];

  return {
    orgUnits,
    roles,
    policies,
    users: userDocs,
    auditLogs,
    parties: partyDocs,
    opportunities,
    contracts,
    projects,
    sites,
    units,
    systems,
    wbs_items: wbsItems,
    execution_budgets: budgets,
    progress_records: progressRecords,
    materials,
    purchase_orders: purchaseOrders,
    inventory_transactions: inventoryTransactions,
    modules: moduleDocs,
    manufacturing_orders: manufacturingOrders,
    logistics_shipments: shipments,
    itps,
    inspections,
    ncrs,
    hse_incidents: hseIncidents,
    accounting_units: [accountingUnit],
    chart_of_accounts: accounts,
    ap_invoices: apInvoices,
    ar_invoices: arInvoices,
    journal_entries: journalEntries,
    fixed_assets: fixedAssets,
    commissioning_packages: commissioningPackages,
    regulatory_actions: regulatoryActions,
    workspacePosts,
    approvalTasks,
    approvalHistory,
    savedViews,
    notifications,
  } satisfies Record<string, Record<string, any>[]>;
}

async function resetPreviousSeed(db: Awaited<ReturnType<typeof getMongoDb>>) {
  for (const collectionName of collectionNames) {
    await db.collection(collectionName).deleteMany({ seedTag: SEED_TAG });
  }
}

async function insertSeedDataset(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  dataset: Record<string, Record<string, any>[]>,
) {
  for (const collectionName of collectionNames) {
    const docs = dataset[collectionName] ?? [];
    if (docs.length === 0) {
      continue;
    }
    await db.collection(collectionName).insertMany(docs);
  }

  const budgetDocs = dataset.execution_budgets ?? [];
  for (const budgetDoc of budgetDocs) {
    await recalculateExecutionBudgetUsage(db, String(budgetDoc._id));
  }
}

async function main() {
  const db = await getMongoDb();
  const dataset = buildSeedDataset();
  const counts = Object.fromEntries(
    Object.entries(dataset)
      .map(([collectionName, docs]) => [collectionName, docs.length] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] > 0),
  ) as Record<string, number>;

  if (shouldDryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          seedTag: SEED_TAG,
          collections: counts,
          totalDocuments: Object.values(counts).reduce((total, value) => total + Number(value), 0),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (shouldReset) {
    await resetPreviousSeed(db);
  }

  await insertSeedDataset(db, dataset);

  console.log(
    JSON.stringify(
      {
        ok: true,
        seedTag: SEED_TAG,
        resetApplied: shouldReset,
        collections: counts,
        totalDocuments: Object.values(counts).reduce((total, value) => total + Number(value), 0),
        sampleProjects: dataset.projects.map((item) => ({
          id: String(item._id),
          code: item.code,
          name: item.name,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await getMongoClient();
    await client.close();
  });
