import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";
import { getProjectAccessScope } from "@/lib/project-access";
import { generateProjectCode } from "@/lib/document-numbers";

export async function GET() {
  const auth = await requireApiPermission("project.read");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const filter =
      projectAccessScope.allowedProjectIds === null
        ? { status: { $ne: "archived" } }
        : {
            status: { $ne: "archived" },
            _id: {
              $in: projectAccessScope.allowedProjectIds
                .filter((projectId) => ObjectId.isValid(projectId))
                .map((projectId) => new ObjectId(projectId)),
            },
          };
    const docs = await db.collection("projects").find(filter).sort({ updatedAt: -1 }).limit(50).toArray();
    const items = docs.map((d) => ({ _id: d._id.toString(), code: d.code, name: d.name, projectType: d.projectType, customerSnapshot: d.customerSnapshot, startDate: d.startDate, endDate: d.endDate, currency: d.currency, status: d.status }));
    return NextResponse.json({ ok: true, source: "database", data: { items }, meta: { total: items.length, defaultProjectId: projectAccessScope.defaultProjectId } } satisfies DomainApiSuccessEnvelope<{ items: typeof items }>);
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("project.create");
  if ("error" in auth) return auth.error;
  try {
    const db = await getMongoDb();
    const body = await request.json();
    const { ObjectId } = await import("mongodb");
    const name = toTrimmedString(body.name);
    const projectType = toTrimmedString(body.projectType);

    if (!name || !projectType) {
      return NextResponse.json({ ok: false, message: "프로젝트명과 프로젝트 유형은 필수입니다." }, { status: 400 });
    }

    let customerSnapshot = null;
    if (body.customerPartyId) {
      const c = await db.collection("parties").findOne({ _id: new ObjectId(body.customerPartyId) });
      if (c) customerSnapshot = { partyId: c._id.toString(), code: c.code, name: c.name, partyRoles: c.partyRoles, taxId: c.taxId || "" };
    }
    const now = new Date().toISOString();
    const result = await db.collection("projects").insertOne({
      code: generateProjectCode(),
      name,
      projectType,
      customerSnapshot,
      startDate: toTrimmedString(body.startDate),
      endDate: toTrimmedString(body.endDate),
      currency: toTrimmedString(body.currency) || "KRW",
      siteSummaries: [],
      status: "planning",
      ...buildCreateMetadata(auth.profile, now),
    });
    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
