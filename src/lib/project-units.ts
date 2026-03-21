import { ObjectId, type Db } from "mongodb";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import { generateUnitNo } from "@/lib/document-numbers";
import type { ViewerProfile } from "@/lib/navigation";
import { buildProjectSnapshot } from "@/lib/project-sites";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

export function buildSiteSnapshot(site: Record<string, unknown>) {
  return {
    siteId: String(site._id),
    code: toTrimmedString(site.code),
    name: toTrimmedString(site.name),
  };
}

export function buildUnitSummary(unit: Record<string, unknown>) {
  return {
    unitId: String(unit._id),
    unitNo: toTrimmedString(unit.unitNo),
    capacity: toTrimmedString(unit.capacity),
    status: toTrimmedString(unit.status),
  };
}

export async function syncSiteUnitSummaries(db: Db, siteId: string) {
  const units = await db
    .collection("units")
    .find({ "siteSnapshot.siteId": siteId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  await db.collection("sites").updateOne(
    { _id: new ObjectId(siteId) },
    {
      $set: {
        unitSummaries: units.map((unit) => buildUnitSummary(unit)),
      },
    },
  );
}

export function normalizeUnitInput(body: Record<string, unknown>) {
  return {
    siteId: toTrimmedString(body.siteId),
    unitNo: toTrimmedString(body.unitNo),
    capacity: toTrimmedString(body.capacity),
    status: toTrimmedString(body.status) || "active",
  };
}

export function validateUnitInput(unit: ReturnType<typeof normalizeUnitInput>) {
  if (!unit.siteId) {
    return "현장을 선택해 주세요.";
  }

  return null;
}

export async function ensureUniqueUnitNo(
  db: Db,
  projectId: string,
  unitNo: string,
  currentUnitId?: string,
) {
  const duplicate = await db.collection("units").findOne({
    "projectSnapshot.projectId": projectId,
    unitNo,
    ...(currentUnitId && ObjectId.isValid(currentUnitId)
      ? { _id: { $ne: new ObjectId(currentUnitId) } }
      : {}),
  });

  return !duplicate;
}

export function buildUnitCreateDocument(
  project: Record<string, unknown>,
  site: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
  unitNo = generateUnitNo(),
) {
  const normalizedUnit = normalizeUnitInput(body);

  return {
    projectSnapshot: buildProjectSnapshot(project),
    siteSnapshot: buildSiteSnapshot(site),
    unitNo,
    capacity: normalizedUnit.capacity,
    systemSummaries: [],
    status: normalizedUnit.status,
    ...buildCreateMetadata(profile, now),
  };
}

export function buildUnitUpdateFields(
  site: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedUnit = normalizeUnitInput(body);

  return {
    siteSnapshot: buildSiteSnapshot(site),
    unitNo: normalizedUnit.unitNo,
    capacity: normalizedUnit.capacity,
    status: normalizedUnit.status,
    updatedAt: now,
    updatedBy: buildActorSnapshot(profile),
  };
}
