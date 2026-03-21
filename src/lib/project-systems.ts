import { ObjectId, type Db } from "mongodb";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import type { ViewerProfile } from "@/lib/navigation";
import { isValidProjectDiscipline } from "@/lib/project-disciplines";
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

export function buildSystemSummary(system: Record<string, unknown>) {
  return {
    systemId: String(system._id),
    code: toTrimmedString(system.code),
    name: toTrimmedString(system.name),
    discipline: toTrimmedString(system.discipline),
  };
}

export async function syncUnitSystemSummaries(db: Db, unitId: string) {
  const systems = await db
    .collection("systems")
    .find({ "unitSnapshot.unitId": unitId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  await db.collection("units").updateOne(
    { _id: new ObjectId(unitId) },
    {
      $set: {
        systemSummaries: systems.map((system) => buildSystemSummary(system)),
      },
    },
  );
}

export function normalizeSystemInput(body: Record<string, unknown>) {
  return {
    unitId: toTrimmedString(body.unitId),
    code: toTrimmedString(body.code),
    name: toTrimmedString(body.name),
    discipline: toTrimmedString(body.discipline),
    status: toTrimmedString(body.status) || "active",
  };
}

export function validateSystemInput(
  system: ReturnType<typeof normalizeSystemInput>,
  options?: { allowLegacyDiscipline?: string },
) {
  if (!system.unitId) {
    return "유닛을 선택해 주세요.";
  }

  if (!system.name) {
    return "시스템명은 비워둘 수 없습니다.";
  }

  if (!system.discipline) {
    return "전문분야를 선택해 주세요.";
  }

  if (
    !isValidProjectDiscipline(system.discipline) &&
    system.discipline !== toTrimmedString(options?.allowLegacyDiscipline)
  ) {
    return "전문분야 값이 올바르지 않습니다.";
  }

  return null;
}

export async function ensureUniqueSystemCode(
  db: Db,
  projectId: string,
  code: string,
  currentSystemId?: string,
) {
  const duplicate = await db.collection("systems").findOne({
    "projectSnapshot.projectId": projectId,
    code,
    ...(currentSystemId && ObjectId.isValid(currentSystemId)
      ? { _id: { $ne: new ObjectId(currentSystemId) } }
      : {}),
  });

  return !duplicate;
}

export function buildSystemCreateDocument(
  project: Record<string, unknown>,
  unit: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  code: string,
  now: string,
) {
  const normalizedSystem = normalizeSystemInput(body);

  return {
    projectSnapshot: buildProjectSnapshot(project),
    unitSnapshot: buildUnitSnapshot(unit),
    code,
    name: normalizedSystem.name,
    discipline: normalizedSystem.discipline,
    parentSystemSnapshot: null,
    turnoverBoundary: "",
    wbsSummaries: [],
    status: normalizedSystem.status,
    ...buildCreateMetadata(profile, now),
  };
}

export function buildSystemUpdateFields(
  unit: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedSystem = normalizeSystemInput(body);

  return {
    unitSnapshot: buildUnitSnapshot(unit),
    name: normalizedSystem.name,
    discipline: normalizedSystem.discipline,
    status: normalizedSystem.status,
    updatedAt: now,
    updatedBy: buildActorSnapshot(profile),
  };
}

export async function syncDependentSystemSnapshots(
  db: Db,
  systemId: string,
  unitSnapshot: ReturnType<typeof buildUnitSnapshot>,
  systemSnapshot: ReturnType<typeof buildSystemSnapshot>,
) {
  await Promise.all([
    db.collection("wbs_items").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          unitSnapshot,
          systemSnapshot,
          discipline: systemSnapshot.discipline,
        },
      },
    ),
    db.collection("modules").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          unitSnapshot,
          systemSnapshot,
        },
      },
    ),
    db.collection("itps").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          systemSnapshot,
        },
      },
    ),
    db.collection("inspections").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          systemSnapshot,
        },
      },
    ),
    db.collection("commissioning_packages").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          unitSnapshot,
          systemSnapshot,
        },
      },
    ),
    db.collection("progress_records").updateMany(
      { "systemSnapshot.systemId": systemId },
      {
        $set: {
          unitSnapshot,
          systemSnapshot,
        },
      },
    ),
  ]);
}
