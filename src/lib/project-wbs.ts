import { ObjectId, type Db } from "mongodb";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import type { ViewerProfile } from "@/lib/navigation";
import { buildProjectSnapshot } from "@/lib/project-sites";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

export function buildUnitSnapshot(unit: Record<string, unknown>) {
  return {
    unitId: String(unit._id),
    unitNo: toTrimmedString(unit.unitNo),
  };
}

export function buildSystemSnapshot(system: Record<string, unknown>) {
  return {
    systemId: String(system._id),
    code: toTrimmedString(system.code),
    name: toTrimmedString(system.name),
    discipline: toTrimmedString(system.discipline),
  };
}

export function buildWbsSnapshot(wbs: Record<string, unknown>) {
  return {
    wbsId: String(wbs._id),
    code: toTrimmedString(wbs.code),
    name: toTrimmedString(wbs.name),
  };
}

function parseWbsCode(code: string) {
  const match = code.match(/^WBS-(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    value: Number(match[1]),
    width: match[1].length,
  };
}

export async function syncSystemWbsSummaries(db: Db, systemId: string) {
  if (!systemId || !ObjectId.isValid(systemId)) {
    return;
  }

  const wbsItems = await db
    .collection("wbs_items")
    .find({ "systemSnapshot.systemId": systemId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  await db.collection("systems").updateOne(
    { _id: new ObjectId(systemId) },
    {
      $set: {
        wbsSummaries: wbsItems.map((wbs) => buildWbsSnapshot(wbs)),
      },
    },
  );
}

export async function syncExecutionBudgetWbsSnapshot(
  db: Db,
  wbsId: string,
  snapshot: ReturnType<typeof buildWbsSnapshot>,
) {
  await db.collection("execution_budgets").updateMany(
    { "wbsSnapshot.wbsId": wbsId },
    {
      $set: {
        wbsSnapshot: snapshot,
      },
    },
  );
}

export function normalizeWbsInput(body: Record<string, unknown>) {
  return {
    unitId: toTrimmedString(body.unitId),
    systemId: toTrimmedString(body.systemId),
    code: toTrimmedString(body.code),
    name: toTrimmedString(body.name),
    costCategory: toTrimmedString(body.costCategory) || "direct",
    status: toTrimmedString(body.status) || "active",
  };
}

export function validateWbsInput(wbs: ReturnType<typeof normalizeWbsInput>) {
  if (!wbs.unitId) {
    return "유닛을 선택해 주세요.";
  }

  if (!wbs.name) {
    return "WBS명은 비워둘 수 없습니다.";
  }

  return null;
}

export async function ensureUniqueWbsCode(
  db: Db,
  projectId: string,
  code: string,
  currentWbsId?: string,
) {
  const duplicate = await db.collection("wbs_items").findOne({
    "projectSnapshot.projectId": projectId,
    code,
    ...(currentWbsId && ObjectId.isValid(currentWbsId)
      ? { _id: { $ne: new ObjectId(currentWbsId) } }
      : {}),
  });

  return !duplicate;
}

export async function generateNextWbsCode(db: Db, projectId: string) {
  const items = await db
    .collection("wbs_items")
    .find({ "projectSnapshot.projectId": projectId })
    .project({ code: 1 })
    .toArray();

  let maxValue = 0;
  let width = 3;

  for (const item of items) {
    const parsed = parseWbsCode(toTrimmedString(item.code));
    if (!parsed) {
      continue;
    }

    if (parsed.value > maxValue) {
      maxValue = parsed.value;
    }
    if (parsed.width > width) {
      width = parsed.width;
    }
  }

  return `WBS-${String(maxValue + 1).padStart(width, "0")}`;
}

export function buildWbsCreateDocument(
  project: Record<string, unknown>,
  unit: Record<string, unknown>,
  system: Record<string, unknown> | null,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
  code: string,
) {
  const normalizedWbs = normalizeWbsInput(body);
  const systemSnapshot = system ? buildSystemSnapshot(system) : null;

  return {
    projectSnapshot: buildProjectSnapshot(project),
    unitSnapshot: buildUnitSnapshot(unit),
    systemSnapshot,
    parentWbsSnapshot: null,
    code,
    name: normalizedWbs.name,
    discipline: systemSnapshot?.discipline || "",
    costCategory: normalizedWbs.costCategory,
    status: normalizedWbs.status,
    ...buildCreateMetadata(profile, now),
  };
}

export function buildWbsUpdateFields(
  unit: Record<string, unknown>,
  system: Record<string, unknown> | null,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedWbs = normalizeWbsInput(body);
  const systemSnapshot = system ? buildSystemSnapshot(system) : null;

  return {
    unitSnapshot: buildUnitSnapshot(unit),
    systemSnapshot,
    name: normalizedWbs.name,
    discipline: systemSnapshot?.discipline || "",
    costCategory: normalizedWbs.costCategory,
    status: normalizedWbs.status,
    updatedAt: now,
    updatedBy: buildActorSnapshot(profile),
  };
}
