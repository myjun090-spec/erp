import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  requireAnyApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
import { getMongoDb } from "@/lib/mongodb";
import { isValidEmailAddress } from "@/lib/email-address";
import { normalizePartyQualifications, serializePartyQualifications } from "@/lib/party-qualifications";

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => toTrimmedString(item)).filter(Boolean))];
}

function sanitizeContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return { contacts: [] as Array<{ name: string; position: string; phone: string; email: string }> };
  }

  const contacts = value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      name: toTrimmedString(item.name),
      position: toTrimmedString(item.position),
      phone: toTrimmedString(item.phone),
      email: toTrimmedString(item.email),
    }))
    .filter((item) => item.name || item.email || item.phone);

  const invalidContact = contacts.find((item) => item.email && !isValidEmailAddress(item.email));
  if (invalidContact) {
    return { contacts: [], error: "연락처 이메일 형식이 올바르지 않습니다." };
  }

  return { contacts };
}

function sanitizeAddresses(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      type: toTrimmedString(item.type),
      line: toTrimmedString(item.line),
      postalCode: toTrimmedString(item.postalCode),
    }))
    .filter((item) => item.type || item.line || item.postalCode);
}

function isVendorOnlyRoles(value: unknown) {
  const partyRoles = sanitizeStringArray(value);
  return partyRoles.length > 0 && partyRoles.every((role) => role === "vendor");
}

function isArchivedStatus(value: unknown) {
  return toTrimmedString(value) === "archived";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("parties").findOne({ _id: new ObjectId(id) });
    if (!doc) return NextResponse.json({ ok: false, message: "거래처를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
        qualifications: serializePartyQualifications(doc.qualifications),
      },
    });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "거래처 ID 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const db = await getMongoDb();
    const body = await request.json();
    const currentDoc = await db.collection("parties").findOne({ _id: new ObjectId(id) });

    if (!currentDoc) {
      return NextResponse.json({ ok: false, message: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    const requestedPartyRoles =
      "partyRoles" in body ? sanitizeStringArray(body.partyRoles) : sanitizeStringArray(currentDoc.partyRoles);
    const vendorOnly = isVendorOnlyRoles(requestedPartyRoles);
    const requiresArchivePermission = isArchivedStatus(body.status);
    const auth = vendorOnly
      ? await requireAnyApiActionPermission(
          requiresArchivePermission
            ? ["party.archive", "vendor.archive"]
            : ["party.update", "vendor.update"],
        )
      : await requireAnyApiActionPermission(
          requiresArchivePermission ? ["party.archive"] : ["party.update"],
        );
    if ("error" in auth) return auth.error;

    const updateFields: Record<string, unknown> = {};

    if ("code" in body) {
      const code = toTrimmedString(body.code);
      if (!code) {
        return NextResponse.json({ ok: false, message: "거래처 코드는 비워둘 수 없습니다." }, { status: 400 });
      }
      if (code !== toTrimmedString(currentDoc.code)) {
        return NextResponse.json(
          { ok: false, message: "거래처 코드는 변경할 수 없습니다." },
          { status: 400 },
        );
      }
    }

    if ("name" in body) {
      const name = toTrimmedString(body.name);
      if (!name) {
        return NextResponse.json({ ok: false, message: "거래처명은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.name = name;
    }

    if ("legalName" in body) {
      updateFields.legalName = toTrimmedString(body.legalName);
    }

    if ("partyRoles" in body) {
      const partyRoles = sanitizeStringArray(body.partyRoles);
      if (partyRoles.length === 0) {
        return NextResponse.json({ ok: false, message: "거래처 유형은 최소 1개 이상 필요합니다." }, { status: 400 });
      }
      updateFields.partyRoles = partyRoles;
    }

    if ("taxId" in body) {
      updateFields.taxId = normalizeBusinessTaxIdForSave(body.taxId);
    }

    if ("country" in body) {
      const country = toTrimmedString(body.country);
      if (!country) {
        return NextResponse.json({ ok: false, message: "국가는 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.country = country;
    }

    if ("contacts" in body) {
      const { contacts, error } = sanitizeContacts(body.contacts);
      if (error) {
        return NextResponse.json({ ok: false, message: error }, { status: 400 });
      }
      updateFields.contacts = contacts;
    }

    if ("addresses" in body) {
      updateFields.addresses = sanitizeAddresses(body.addresses);
    }

    if ("qualifications" in body) {
      updateFields.qualifications = normalizePartyQualifications(body.qualifications);
    }

    if ("status" in body) {
      const status = toTrimmedString(body.status);
      if (!["active", "suspended", "archived"].includes(status)) {
        return NextResponse.json({ ok: false, message: "거래처 상태가 유효하지 않습니다." }, { status: 400 });
      }
      updateFields.status = status;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ ok: false, message: "수정 가능한 필드가 없습니다." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.collection("parties").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updateFields, updatedAt: now }, $inc: { documentVersion: 1 } },
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, message: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, action: "update", affectedCount: result.modifiedCount, targetIds: [id] });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 }); }
}
