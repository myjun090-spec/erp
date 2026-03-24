import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import {
  buildActorSnapshot,
  buildCreateMetadata,
  resolveStatus,
  stripProtectedCreateFields,
  toTrimmedString,
} from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

const allowedStatuses = new Set(["requested", "connected", "completed", "failed"]);
const allowedLinkageTypes = new Set(["internal", "external"]);
const allowedServiceCategories = new Set(["의료", "심리상담", "법률", "주거", "취업", "교육", "돌봄"]);

async function generateLinkageNo(db: import("mongodb").Db) {
  const now = new Date();
  const prefix = `SL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDoc = await db
    .collection("service_linkages")
    .find({ linkageNo: { $regex: `^${prefix}` } })
    .sort({ linkageNo: -1 })
    .limit(1)
    .toArray();

  if (lastDoc.length === 0) return `${prefix}-0001`;
  const seq = parseInt((lastDoc[0].linkageNo as string).split("-").pop() || "0", 10);
  return `${prefix}-${String(seq + 1).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("service_linkages")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      linkageNo: doc.linkageNo,
      clientSnapshot: doc.clientSnapshot,
      linkageType: doc.linkageType,
      serviceCategory: doc.serviceCategory,
      referralOrg: doc.referralOrg,
      referralDate: doc.referralDate,
      workerSnapshot: doc.workerSnapshot,
      status: doc.status,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("service-linkage.create");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const body = stripProtectedCreateFields(await request.json());
    const now = new Date().toISOString();

    const linkageType = toTrimmedString(body.linkageType) || "external";
    const serviceCategory = toTrimmedString(body.serviceCategory);
    const referralOrg = toTrimmedString(body.referralOrg);
    const referralContact = toTrimmedString(body.referralContact);
    const referralDate = toTrimmedString(body.referralDate) || now.slice(0, 10);
    const responseDate = toTrimmedString(body.responseDate);
    const resultDescription = toTrimmedString(body.resultDescription);
    const status = resolveStatus(body.status, "requested");

    if (!allowedLinkageTypes.has(linkageType)) {
      return NextResponse.json({ ok: false, message: "연계유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (serviceCategory && !allowedServiceCategories.has(serviceCategory)) {
      return NextResponse.json({ ok: false, message: "서비스분류가 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const clientSnapshot = body.clientSnapshot && typeof body.clientSnapshot === "object" ? body.clientSnapshot : null;
    if (!clientSnapshot) {
      return NextResponse.json({ ok: false, message: "이용자 정보는 필수입니다." }, { status: 400 });
    }

    const casePlanSnapshot = body.casePlanSnapshot && typeof body.casePlanSnapshot === "object" ? body.casePlanSnapshot : null;
    const linkageNo = await generateLinkageNo(db);
    const workerSnapshot = buildActorSnapshot(auth.profile);

    const result = await db.collection("service_linkages").insertOne({
      linkageNo,
      clientSnapshot,
      casePlanSnapshot,
      linkageType,
      serviceCategory,
      referralOrg,
      referralContact,
      referralDate,
      responseDate,
      resultDescription,
      workerSnapshot,
      status,
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json(
      { ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
