import { ObjectId, type Db } from "mongodb";
import { buildActorSnapshot, buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import { generateSiteCode } from "@/lib/document-numbers";
import type { ViewerProfile } from "@/lib/navigation";

type MutableViewerProfile = Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">;

export function buildProjectSnapshot(project: Record<string, unknown>) {
  return {
    projectId: String(project._id),
    code: toTrimmedString(project.code),
    name: toTrimmedString(project.name),
    projectType: toTrimmedString(project.projectType),
  };
}

export function buildSiteSummary(site: Record<string, unknown>) {
  return {
    siteId: String(site._id),
    code: toTrimmedString(site.code),
    name: toTrimmedString(site.name),
    country: toTrimmedString(site.country),
    status: toTrimmedString(site.status),
  };
}

export async function syncProjectSiteSummaries(db: Db, projectId: string) {
  const sites = await db
    .collection("sites")
    .find({ "projectSnapshot.projectId": projectId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  await db.collection("projects").updateOne(
    { _id: new ObjectId(projectId) },
    {
      $set: {
        siteSummaries: sites.map((site) => buildSiteSummary(site)),
      },
    },
  );
}

export function normalizeSiteInput(body: Record<string, unknown>) {
  return {
    code: toTrimmedString(body.code),
    name: toTrimmedString(body.name),
    country: toTrimmedString(body.country),
    address: toTrimmedString(body.address),
    status: toTrimmedString(body.status) || "active",
  };
}

export function validateSiteInput(site: ReturnType<typeof normalizeSiteInput>) {
  if (!site.name) {
    return "현장명은 비워둘 수 없습니다.";
  }

  return null;
}

export function buildSiteCreateDocument(
  project: Record<string, unknown>,
  profile: MutableViewerProfile,
  body: Record<string, unknown>,
  now: string,
) {
  const normalizedSite = normalizeSiteInput(body);

  return {
    code: generateSiteCode(),
    name: normalizedSite.name,
    projectSnapshot: buildProjectSnapshot(project),
    country: normalizedSite.country,
    address: normalizedSite.address,
    siteManagerSnapshot: buildActorSnapshot(profile),
    unitSummaries: [],
    status: normalizedSite.status,
    ...buildCreateMetadata(profile, now),
  };
}
