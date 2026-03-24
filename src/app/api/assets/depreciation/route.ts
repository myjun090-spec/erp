import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import {
  buildFixedAssetDepreciationState,
  supportsAutomaticDepreciationSchedule,
} from "@/lib/fixed-assets";
import { getMongoDb } from "@/lib/mongodb";
import { getFacilityAccessScope } from "@/lib/facility-access";
import { buildFacilityFilter, getFacilityIdFromRequest } from "@/lib/facility-scope";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("asset.depreciation-run");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const facilityId = getFacilityIdFromRequest(request);
    const facilityAccessScope = await getFacilityAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const docs = await db
      .collection("fixed_assets")
      .find(
        buildFacilityFilter(
          facilityId,
          { status: { $ne: "archived" } },
          facilityAccessScope.allowedFacilityIds,
        ),
      )
      .project({
        _id: 1,
        assetNo: 1,
        acquisitionDate: 1,
        acquisitionCost: 1,
        usefulLifeMonths: 1,
        depreciationMethod: 1,
        ledgerSummary: 1,
        depreciationSchedule: 1,
      })
      .toArray();

    const now = new Date().toISOString();
    const bulkOperations = [];
    const skippedAssets: string[] = [];

    for (const doc of docs) {
      if (!supportsAutomaticDepreciationSchedule(doc.depreciationMethod)) {
        skippedAssets.push(String(doc.assetNo || "-"));
        continue;
      }

      const depreciationState = buildFixedAssetDepreciationState({
        acquisitionDate: String(doc.acquisitionDate || ""),
        acquisitionCost: Number(doc.acquisitionCost || 0),
        usefulLifeMonths: Number(doc.usefulLifeMonths || 0),
        depreciationMethod: String(doc.depreciationMethod || ""),
        ledgerSummary: doc.ledgerSummary,
        depreciationSchedule: doc.depreciationSchedule,
      });

      bulkOperations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              ledgerSummary: depreciationState.ledgerSummary,
              depreciationSchedule: depreciationState.depreciationSchedule,
              updatedAt: now,
            },
          },
        },
      });
    }

    if (bulkOperations.length > 0) {
      await db.collection("fixed_assets").bulkWrite(bulkOperations);
    }

    return NextResponse.json({
      ok: true,
      data: {
        recalculatedCount: bulkOperations.length,
        skippedCount: skippedAssets.length,
        skippedAssets: skippedAssets.slice(0, 10),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
