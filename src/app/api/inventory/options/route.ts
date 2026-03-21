import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";
import { buildProjectFilter, getProjectIdFromRequest } from "@/lib/project-scope";

type InventoryOption = {
  value: string;
  label: string;
  uom?: string;
};

type InventoryStockSummary = {
  materialId: string;
  siteId: string;
  storageLocation: string;
  currentQuantity: number;
  uom: string;
  lotNo: string;
  serialNo: string;
  expiryDate: string;
  qualityStatus: string;
};

export async function GET(request: Request) {
  const auth = await requireApiPermission("supply-chain.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const [siteDocs, materialDocs, summaryDocs] = await Promise.all([
      db
        .collection("sites")
        .find(
          buildProjectFilter(
            projectId,
            { status: { $ne: "archived" } },
            projectAccessScope.allowedProjectIds,
          ),
        )
        .project({ code: 1, name: 1 })
        .sort({ code: 1, name: 1 })
        .limit(200)
        .toArray(),
      db
        .collection("materials")
        .find({ status: { $ne: "archived" } })
        .project({ materialCode: 1, description: 1, uom: 1 })
        .sort({ materialCode: 1 })
        .limit(200)
        .toArray(),
      db
        .collection("inventory_transactions")
        .aggregate([
          {
            $match: {
              ...buildProjectFilter(projectId, {}, projectAccessScope.allowedProjectIds),
              $or: [
                { status: "completed" },
                { status: "confirmed" },
                { status: { $exists: false } },
                { status: "" },
              ],
            },
          },
          {
            $group: {
              _id: {
                materialId: "$materialSnapshot.materialId",
                siteId: "$siteSnapshot.siteId",
                storageLocation: "$storageLocation",
                uom: "$uom",
                lotNo: "$lotNo",
                serialNo: "$serialNo",
                expiryDate: "$expiryDate",
                qualityStatus: "$qualityStatus",
              },
              currentQuantity: {
                $sum: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ["$transactionType", "transfer"] },
                        then: 0,
                      },
                      {
                        case: { $eq: ["$transactionType", "issue"] },
                        then: { $multiply: ["$quantity", -1] },
                      },
                      {
                        case: {
                          $and: [
                            { $eq: ["$transactionType", "adjustment"] },
                            { $eq: ["$adjustmentDirection", "decrease"] },
                          ],
                        },
                        then: { $multiply: ["$quantity", -1] },
                      },
                    ],
                    default: "$quantity",
                  },
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const sites: InventoryOption[] = siteDocs.map((site) => ({
      value: site._id.toString(),
      label: `${typeof site.code === "string" ? site.code : "-"} · ${
        typeof site.name === "string" ? site.name : "-"
      }`,
    }));
    const materials: InventoryOption[] = materialDocs.map((material) => ({
      value: material._id.toString(),
      label: `${typeof material.materialCode === "string" ? material.materialCode : "-"} · ${
        typeof material.description === "string" ? material.description : "-"
      }`,
      uom: typeof material.uom === "string" ? material.uom : "",
    }));
    const summary: InventoryStockSummary[] = summaryDocs
      .map((doc) => {
        const summaryId =
          doc._id && typeof doc._id === "object" ? (doc._id as Record<string, unknown>) : {};

        return {
          materialId: typeof summaryId.materialId === "string" ? summaryId.materialId : "",
          siteId: typeof summaryId.siteId === "string" ? summaryId.siteId : "",
          storageLocation:
            typeof summaryId.storageLocation === "string" ? summaryId.storageLocation : "",
          currentQuantity: typeof doc.currentQuantity === "number" ? doc.currentQuantity : 0,
          uom: typeof summaryId.uom === "string" ? summaryId.uom : "",
          lotNo: typeof summaryId.lotNo === "string" ? summaryId.lotNo : "",
          serialNo: typeof summaryId.serialNo === "string" ? summaryId.serialNo : "",
          expiryDate: typeof summaryId.expiryDate === "string" ? summaryId.expiryDate : "",
          qualityStatus:
            typeof summaryId.qualityStatus === "string" ? summaryId.qualityStatus : "available",
        };
      })
      .filter((item) => item.materialId && item.siteId && item.storageLocation);

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { sites, materials, summary },
      meta: { total: sites.length + materials.length + summary.length },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
