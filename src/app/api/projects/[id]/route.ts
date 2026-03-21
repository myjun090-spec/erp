import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { hasProjectAccess } from "@/lib/project-scope";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("project.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    if (!hasProjectAccess(id, projectAccessScope.allowedProjectIds)) {
      return NextResponse.json({ ok: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("projects").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    // 관련 sites, units, systems 조회
    const sites = await db.collection("sites").find({ "projectSnapshot.projectId": id }).toArray();
    const units = await db.collection("units").find({ "projectSnapshot.projectId": id }).toArray();
    const systems = await db.collection("systems").find({ "projectSnapshot.projectId": id }).toArray();
    const wbs = await db.collection("wbs_items").find({ "projectSnapshot.projectId": id }).toArray();
    return NextResponse.json({ ok: true, source: "database", data: {
      ...doc, _id: doc._id.toString(),
      _sites: sites.map(s => ({ ...s, _id: s._id.toString() })),
      _units: units.map(u => ({ ...u, _id: u._id.toString() })),
      _systems: systems.map(s => ({ ...s, _id: s._id.toString() })),
      _wbs: wbs.map(w => ({ ...w, _id: w._id.toString() })),
    }});
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("project.update");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    if (!hasProjectAccess(id, projectAccessScope.allowedProjectIds)) {
      return NextResponse.json({ ok: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "프로젝트 ID 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const db = await getMongoDb();
    const body = await request.json();
    const updateFields: Record<string, unknown> = {};

    if ("name" in body) {
      const name = toTrimmedString(body.name);
      if (!name) {
        return NextResponse.json({ ok: false, message: "프로젝트명은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.name = name;
    }

    if ("projectType" in body) {
      const projectType = toTrimmedString(body.projectType);
      if (!projectType) {
        return NextResponse.json({ ok: false, message: "프로젝트유형은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.projectType = projectType;
    }

    if ("customerPartyId" in body) {
      const customerPartyId = toTrimmedString(body.customerPartyId);
      if (!customerPartyId || !ObjectId.isValid(customerPartyId)) {
        return NextResponse.json({ ok: false, message: "고객 ID가 유효하지 않습니다." }, { status: 400 });
      }
      const customer = await db.collection("parties").findOne({ _id: new ObjectId(customerPartyId) });
      if (!customer) {
        return NextResponse.json({ ok: false, message: "등록 가능한 고객 정보를 찾지 못했습니다." }, { status: 400 });
      }
      updateFields.customerSnapshot = {
        partyId: customer._id.toString(),
        code: customer.code,
        name: customer.name,
        partyRoles: customer.partyRoles,
        taxId: customer.taxId || "",
      };
    }

    if ("startDate" in body) {
      updateFields.startDate = toTrimmedString(body.startDate);
    }

    if ("endDate" in body) {
      updateFields.endDate = toTrimmedString(body.endDate);
    }

    if ("currency" in body) {
      const currency = toTrimmedString(body.currency);
      if (!currency) {
        return NextResponse.json({ ok: false, message: "통화는 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.currency = currency;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ ok: false, message: "수정 가능한 필드가 없습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("projects").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updateFields, updatedAt: now }, $inc: { documentVersion: 1 } },
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, action: "update", affectedCount: result.modifiedCount, targetIds: [id] });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
