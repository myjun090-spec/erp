import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission, requireApiActionPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot, resolveStatus, toTrimmedString } from "@/lib/domain-write";

const allowedStatuses = new Set(["requested", "connected", "completed", "failed"]);
const allowedLinkageTypes = new Set(["internal", "external"]);
const allowedServiceCategories = new Set(["의료", "심리상담", "법률", "주거", "취업", "교육", "돌봄"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("client-case.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "서비스연계를 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("service_linkages").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "서비스연계를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("service-linkage.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "서비스연계를 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const doc = await db.collection("service_linkages").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "서비스연계를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const linkageType = toTrimmedString(body.linkageType ?? doc.linkageType);
    const serviceCategory = toTrimmedString(body.serviceCategory ?? doc.serviceCategory);
    const referralOrg = toTrimmedString(body.referralOrg ?? doc.referralOrg);
    const referralContact = toTrimmedString(body.referralContact ?? doc.referralContact);
    const referralDate = toTrimmedString(body.referralDate ?? doc.referralDate);
    const responseDate = toTrimmedString(body.responseDate ?? doc.responseDate);
    const resultDescription = toTrimmedString(body.resultDescription ?? doc.resultDescription);
    const status = resolveStatus(body.status, toTrimmedString(doc.status) || "requested");

    if (!allowedLinkageTypes.has(linkageType)) {
      return NextResponse.json({ ok: false, message: "연계유형이 올바르지 않습니다." }, { status: 400 });
    }

    if (serviceCategory && !allowedServiceCategories.has(serviceCategory)) {
      return NextResponse.json({ ok: false, message: "서비스분류가 올바르지 않습니다." }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, message: "상태가 올바르지 않습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("service_linkages").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          linkageType,
          serviceCategory,
          referralOrg,
          referralContact,
          referralDate,
          responseDate,
          resultDescription,
          status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({ ok: true, data: { _id: id } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
