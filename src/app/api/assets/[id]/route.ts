import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import {
  buildFixedAssetDepreciationState,
  normalizeFixedAssetInput,
  normalizeLedgerSummary,
  serializeFixedAsset,
  validateFixedAssetInput,
} from "@/lib/fixed-assets";
import { getMongoDb } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { hasProjectAccess } from "@/lib/facility-scope";
// buildProjectSnapshot removed - using facilitySnapshot

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }
    const db = await getMongoDb();
    const doc = await db.collection("fixed_assets").findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const facilityId =
      doc.facilitySnapshot && typeof doc.facilitySnapshot === "object"
        ? String((doc.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    if (
      facilityAccessScope.allowedFacilityIds &&
      !hasProjectAccess(facilityId, facilityAccessScope.allowedFacilityIds)
    ) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, source: "database", data: serializeFixedAsset(doc) });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActionPermission("asset.update");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const currentDoc = await db.collection("fixed_assets").findOne({ _id: new ObjectId(id) });
    if (!currentDoc) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }
    if (String(currentDoc.status || "") === "archived") {
      return NextResponse.json(
        { ok: false, message: "보관된 자산은 복원 후 수정할 수 있습니다." },
        { status: 409 },
      );
    }

    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const currentFacilityId =
      currentDoc.facilitySnapshot && typeof currentDoc.facilitySnapshot === "object"
        ? String((currentDoc.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    if (
      facilityAccessScope.allowedFacilityIds &&
      !hasProjectAccess(currentFacilityId, facilityAccessScope.allowedFacilityIds)
    ) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const facilityId = typeof body.facilityId === "string" ? body.facilityId.trim() : "";
    const normalizedInput = normalizeFixedAssetInput(body);
    const validationError = validateFixedAssetInput(normalizedInput, facilityId);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }
    if (!ObjectId.isValid(facilityId)) {
      return NextResponse.json({ ok: false, message: "프로젝트 식별자가 올바르지 않습니다." }, { status: 400 });
    }
    if (
      facilityAccessScope.allowedFacilityIds &&
      !facilityAccessScope.allowedFacilityIds.includes(facilityId)
    ) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트에 접근할 수 없습니다." }, { status: 403 });
    }
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(facilityId),
      status: { $ne: "archived" },
    });
    if (!project) {
      return NextResponse.json({ ok: false, message: "선택한 프로젝트를 찾을 수 없습니다." }, { status: 400 });
    }

    const duplicateAsset = await db.collection("fixed_assets").findOne({
      _id: { $ne: new ObjectId(id) },
      assetNo: normalizedInput.assetNo,
    });
    if (duplicateAsset) {
      return NextResponse.json({ ok: false, message: "이미 사용 중인 자산번호입니다." }, { status: 409 });
    }

    const previousLedgerSummary =
      currentDoc.ledgerSummary && typeof currentDoc.ledgerSummary === "object"
        ? (currentDoc.ledgerSummary as Record<string, unknown>)
        : null;
    const currentLedgerSummary = normalizeLedgerSummary(
      previousLedgerSummary,
      Number(currentDoc.acquisitionCost || 0),
    );
    if (
      currentLedgerSummary.accumulatedDepreciation > 0 &&
      normalizedInput.acquisitionCost !== Number(currentDoc.acquisitionCost || 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "감가상각이 시작된 자산은 취득가액을 직접 수정할 수 없습니다.",
        },
        { status: 400 },
      );
    }
    const depreciationState = buildFixedAssetDepreciationState({
      acquisitionDate: normalizedInput.acquisitionDate,
      acquisitionCost: normalizedInput.acquisitionCost,
      usefulLifeMonths: normalizedInput.usefulLifeMonths,
      depreciationMethod: normalizedInput.depreciationMethod,
      ledgerSummary: previousLedgerSummary,
      depreciationSchedule: currentDoc.depreciationSchedule,
    });
    const ledgerSummary = normalizeLedgerSummary(
      depreciationState.ledgerSummary,
      normalizedInput.acquisitionCost,
    );
    const now = new Date().toISOString();

    const result = await db.collection("fixed_assets").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          assetClass: normalizedInput.assetClass,
          facilitySnapshot: body.facilitySnapshot ?? null,
          location: normalizedInput.location,
          acquisitionDate: normalizedInput.acquisitionDate,
          acquisitionCost: normalizedInput.acquisitionCost,
          usefulLifeMonths: normalizedInput.usefulLifeMonths,
          depreciationMethod: normalizedInput.depreciationMethod,
          ledgerSummary,
          depreciationSchedule: depreciationState.depreciationSchedule,
          status: normalizedInput.status,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const db = await getMongoDb();
    const currentDoc = await db.collection("fixed_assets").findOne({ _id: new ObjectId(id) });
    if (!currentDoc) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action.trim() : "";
    if (action !== "archive" && action !== "restore") {
      return NextResponse.json({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    const auth = await requireApiActionPermission(
      action === "archive" ? "asset.archive" : "asset.restore",
    );
    if ("error" in auth) return auth.error;

    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });
    const facilityId =
      currentDoc.facilitySnapshot && typeof currentDoc.facilitySnapshot === "object"
        ? String((currentDoc.facilitySnapshot as Record<string, unknown>).facilityId ?? "")
        : "";
    if (
      facilityAccessScope.allowedFacilityIds &&
      !hasProjectAccess(facilityId, facilityAccessScope.allowedFacilityIds)
    ) {
      return NextResponse.json({ ok: false, message: "고정자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date().toISOString();
    let result;

    if (action === "archive") {
      result = await db.collection("fixed_assets").updateOne(
        { _id: new ObjectId(id), status: { $ne: "archived" } },
        {
          $set: {
            status: "archived",
            archivedAt: now,
            archivedFromStatus:
              typeof currentDoc.status === "string" && currentDoc.status.trim()
                ? currentDoc.status.trim()
                : "inactive",
            updatedAt: now,
            updatedBy: buildActorSnapshot(auth.profile),
          },
          $inc: { documentVersion: 1 },
        },
      );
    } else {
      if (String(currentDoc.status || "") !== "archived") {
        return NextResponse.json(
          { ok: false, message: "보관된 자산만 복원할 수 있습니다." },
          { status: 409 },
        );
      }

      const project = await db.collection("projects").findOne({
        _id: new ObjectId(facilityId),
        status: { $ne: "archived" },
      });
      if (!project) {
        return NextResponse.json(
          { ok: false, message: "연결된 프로젝트가 보관되어 자산을 복원할 수 없습니다." },
          { status: 409 },
        );
      }

      const restoredStatus =
        typeof currentDoc.archivedFromStatus === "string" &&
        currentDoc.archivedFromStatus.trim() &&
        currentDoc.archivedFromStatus !== "archived"
          ? currentDoc.archivedFromStatus.trim()
          : "inactive";

      result = await db.collection("fixed_assets").updateOne(
        { _id: new ObjectId(id), status: "archived" },
        {
          $set: {
            status: restoredStatus,
            updatedAt: now,
            updatedBy: buildActorSnapshot(auth.profile),
          },
          $unset: {
            archivedAt: "",
            archivedFromStatus: "",
          },
          $inc: { documentVersion: 1 },
        },
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
