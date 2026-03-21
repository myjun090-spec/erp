import { loadEnvConfig } from "@next/env";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "../src/lib/domain-write";
import { getMongoClient, getMongoDb } from "../src/lib/mongodb";
import { allPermissionCatalog } from "../src/lib/navigation";

loadEnvConfig(process.cwd());

const SEED_TAG = "erp-bootstrap-admin-v20260321";
const ROLE_CODE = "ROLE-BOOTSTRAP-PLATFORM-ADMIN";
const ROLE_NAME = "Bootstrap Platform Admin";
const ORG_CODE = "ORG-BOOTSTRAP-PLATFORM";
const DEFAULT_ORG_NAME = "ERP Platform";

const seedActor = {
  displayName: "Bootstrap Admin Seeder",
  orgUnitName: DEFAULT_ORG_NAME,
  email: "seed.bootstrap@local.erp",
};

type PersistedUserDoc = {
  _id?: { toString(): string } | string;
  employeeNo?: string;
  defaultProjectId?: string;
  projectAssignments?: Array<{
    projectId?: string;
    siteIds?: string[];
  }>;
};

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);

  if (index < 0) {
    return "";
  }

  return toTrimmedString(process.argv[index + 1]);
}

function titleCaseFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "admin";
  const words = localPart
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "Bootstrap Admin";
  }

  return words
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function buildEmployeeNo(email: string) {
  const seed = email
    .split("@")[0]
    ?.toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  return `BOOT-${seed || "ADMIN"}`;
}

function normalizeId(value: PersistedUserDoc["_id"]) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toString();
}

function getRequiredEmail() {
  const email = readArg("--email").toLowerCase();

  if (!email) {
    throw new Error("Missing required --email argument.");
  }

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!isValid) {
    throw new Error("Invalid --email value.");
  }

  return email;
}

async function main() {
  const email = getRequiredEmail();
  const name = readArg("--name") || titleCaseFromEmail(email);
  const orgName = readArg("--org-name") || DEFAULT_ORG_NAME;
  const now = new Date().toISOString();
  const actorSnapshot = buildActorSnapshot(seedActor);
  const db = await getMongoDb();

  const roles = db.collection("roles");
  const orgUnits = db.collection("orgUnits");
  const users = db.collection<PersistedUserDoc & Record<string, unknown>>("users");

  const existingRole = await roles.findOne({ code: ROLE_CODE });
  await roles.updateOne(
    { code: ROLE_CODE },
    {
      $set: {
        code: ROLE_CODE,
        name: ROLE_NAME,
        scope: "공통",
        permissions: [...allPermissionCatalog],
        state: "활성",
        updatedAt: now,
        updatedBy: actorSnapshot,
        seedTag: SEED_TAG,
      },
      $setOnInsert: {
        memberCount: 0,
        ...buildCreateMetadata(seedActor, now),
      },
    },
    { upsert: true },
  );

  const existingUser = await users.findOne({ email });
  const projectAssignments = Array.isArray(existingUser?.projectAssignments)
    ? existingUser.projectAssignments
    : [];
  const defaultProjectId = toTrimmedString(existingUser?.defaultProjectId);
  const employeeNo = toTrimmedString(existingUser?.employeeNo) || buildEmployeeNo(email);

  await users.updateOne(
    { email },
    {
      $set: {
        name,
        displayName: name,
        email,
        employeeNo,
        orgUnitCode: ORG_CODE,
        orgUnitName: orgName,
        roleCode: ROLE_CODE,
        roleName: ROLE_NAME,
        provider: "Google SSO",
        state: "활성",
        lastSeenAt: "-",
        defaultProjectId,
        projectAssignments,
        updatedAt: now,
        updatedBy: actorSnapshot,
        seedTag: SEED_TAG,
      },
      $setOnInsert: {
        ...buildCreateMetadata(seedActor, now),
      },
    },
    { upsert: true },
  );

  const userDoc = await users.findOne({ email });

  if (!userDoc) {
    throw new Error("Failed to upsert bootstrap admin user.");
  }

  const memberCount = await users.countDocuments({ orgUnitCode: ORG_CODE });
  const roleMemberCount = await users.countDocuments({ roleCode: ROLE_CODE });
  const leadUserId = normalizeId(userDoc._id);

  const existingOrgUnit = await orgUnits.findOne({ code: ORG_CODE });
  await orgUnits.updateOne(
    { code: ORG_CODE },
    {
      $set: {
        code: ORG_CODE,
        name: orgName,
        category: "플랫폼",
        leadName: name,
        leadUserId,
        leadEmail: email,
        memberCount,
        state: "활성",
        updatedAt: now,
        updatedBy: actorSnapshot,
        seedTag: SEED_TAG,
      },
      $setOnInsert: {
        ...buildCreateMetadata(seedActor, now),
      },
    },
    { upsert: true },
  );

  await roles.updateOne(
    { code: ROLE_CODE },
    {
      $set: {
        memberCount: roleMemberCount,
        updatedAt: now,
        updatedBy: actorSnapshot,
      },
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        actions: {
          role: existingRole ? "update" : "create",
          orgUnit: existingOrgUnit ? "update" : "create",
          user: existingUser ? "update" : "create",
        },
        bootstrapAdmin: {
          email,
          name,
          orgCode: ORG_CODE,
          orgName,
          roleCode: ROLE_CODE,
          roleName: ROLE_NAME,
        },
        note:
          "Google OAuth env is still required. If GOOGLE_HOSTED_DOMAIN is set, the email must match that domain.",
      },
      null,
      2,
    ),
  );

  const client = await getMongoClient();
  await client.close();
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
