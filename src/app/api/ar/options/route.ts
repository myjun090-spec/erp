import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import { buildContractBillingSummary, buildContractSnapshot } from "@/lib/contract-billing";
import { getMongoDb } from "@/lib/mongodb";
import { getProjectAccessScope } from "@/lib/project-access";

export async function GET() {
  const auth = await requireApiPermission("finance.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const projectFilter =
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

    const [customers, projects, contracts] = await Promise.all([
      db
        .collection("parties")
        .find({
          partyRoles: "customer",
          status: { $ne: "archived" },
        })
        .project({
          code: 1,
          name: 1,
        })
        .sort({ code: 1, name: 1 })
        .limit(200)
        .toArray(),
      db
        .collection("projects")
        .find(projectFilter)
        .project({
          code: 1,
          name: 1,
          customerSnapshot: 1,
        })
        .sort({ code: 1, name: 1 })
        .limit(200)
        .toArray(),
      db
        .collection("contracts")
        .find({
          ...(projectAccessScope.allowedProjectIds === null
            ? {}
            : {
                "projectSnapshot.projectId": {
                  $in: projectAccessScope.allowedProjectIds,
                },
              }),
          status: { $in: ["active", "completed"] },
        })
        .project({
          contractNo: 1,
          title: 1,
          contractType: 1,
          contractAmount: 1,
          amendments: 1,
          currency: 1,
          customerSnapshot: 1,
          projectSnapshot: 1,
        })
        .sort({ contractNo: 1, title: 1 })
        .limit(200)
        .toArray(),
    ]);

    const contractBillingSummaryById = new Map(
      (
        await Promise.all(
          contracts.map(async (contract) => [
            contract._id.toString(),
            await buildContractBillingSummary(db, contract),
          ] as const),
        )
      ).map(([contractId, summary]) => [contractId, summary]),
    );

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        customers: customers.map((customer) => ({
          _id: customer._id.toString(),
          code: typeof customer.code === "string" ? customer.code : "",
          name: typeof customer.name === "string" ? customer.name : "",
        })),
        projects: projects.map((project) => ({
          _id: project._id.toString(),
          code: typeof project.code === "string" ? project.code : "",
          name: typeof project.name === "string" ? project.name : "",
          customerSnapshot:
            project.customerSnapshot && typeof project.customerSnapshot === "object"
              ? project.customerSnapshot
              : null,
        })),
        contracts: contracts.map((contract) => ({
          ...buildContractSnapshot(contract),
          customerSnapshot:
            contract.customerSnapshot && typeof contract.customerSnapshot === "object"
              ? contract.customerSnapshot
              : null,
          projectSnapshot:
            contract.projectSnapshot && typeof contract.projectSnapshot === "object"
              ? contract.projectSnapshot
              : null,
          billingSummary: contractBillingSummaryById.get(contract._id.toString()) ?? {
            contractAmount: typeof contract.contractAmount === "number" ? contract.contractAmount : 0,
            billedAmount: 0,
            remainingBillableAmount:
              typeof contract.contractAmount === "number" ? contract.contractAmount : 0,
            invoiceCount: 0,
          },
        })),
      },
      meta: {
        total: customers.length + projects.length + contracts.length,
        defaultProjectId: projectAccessScope.defaultProjectId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
