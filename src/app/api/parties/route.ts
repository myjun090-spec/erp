import { NextResponse } from "next/server";
import {
  requireAnyApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
import { generatePartyCode, generateVendorCode } from "@/lib/document-numbers";
import { getMongoDb } from "@/lib/mongodb";
import { buildCreateMetadata, toTrimmedString } from "@/lib/domain-write";
import type { DomainApiSuccessEnvelope, DomainApiErrorEnvelope } from "@/lib/domain-api";
import { isValidEmailAddress } from "@/lib/email-address";
import { normalizePartyQualifications, serializePartyQualifications } from "@/lib/party-qualifications";

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
  const partyRoles = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

  return partyRoles.length > 0 && partyRoles.every((role) => role === "vendor");
}

export async function GET() {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const docs = await db
      .collection("parties")
      .find({ status: { $ne: "archived" } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    const items = docs.map((doc) => ({
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      legalName: doc.legalName || "",
      partyRoles: doc.partyRoles || [],
      taxId: doc.taxId || "",
      country: doc.country || "",
      contacts: doc.contacts || [],
      addresses: doc.addresses || [],
      qualifications: serializePartyQualifications(doc.qualifications),
      status: doc.status,
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { items },
      meta: { total: items.length },
    } satisfies DomainApiSuccessEnvelope<{ items: typeof items }>);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" } satisfies DomainApiErrorEnvelope,
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const auth = isVendorOnlyRoles(body.partyRoles)
      ? await requireAnyApiActionPermission(["party.create", "vendor.create"])
      : await requireAnyApiActionPermission(["party.create"]);
    if ("error" in auth) return auth.error;

    const db = await getMongoDb();
    const now = new Date().toISOString();
    const name = toTrimmedString(body.name);
    const { contacts, error } = sanitizeContacts(body.contacts);

    if (!name) {
      return NextResponse.json(
        { ok: false, message: "거래처명은 필수입니다." } satisfies DomainApiErrorEnvelope,
        { status: 400 },
      );
    }

    if (error) {
      return NextResponse.json(
        { ok: false, message: error } satisfies DomainApiErrorEnvelope,
        { status: 400 },
      );
    }

    const partyRoles = Array.isArray(body.partyRoles)
      ? body.partyRoles.filter((item: unknown): item is string => typeof item === "string")
      : [];
    const inputCode = toTrimmedString(body.code);
    const code =
      inputCode ||
      (partyRoles.length > 0 && partyRoles.every((role: string) => role === "vendor")
        ? generateVendorCode()
        : generatePartyCode());
    const qualifications = normalizePartyQualifications(body.qualifications);

    const result = await db.collection("parties").insertOne({
      code,
      name,
      legalName: toTrimmedString(body.legalName),
      partyRoles,
      taxId: normalizeBusinessTaxIdForSave(body.taxId),
      country: toTrimmedString(body.country) || "KR",
      contacts,
      addresses: sanitizeAddresses(body.addresses),
      bankAccounts: [],
      qualifications,
      status: "active",
      ...buildCreateMetadata(auth.profile, now),
    });

    return NextResponse.json({ ok: true, action: "create", affectedCount: 1, targetIds: [result.insertedId.toString()] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
