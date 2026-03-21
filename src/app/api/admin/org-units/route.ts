import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  createAdminOrgUnit,
  isAdminStoreError,
  type AdminOrgProvisionInput,
} from "@/lib/admin-store";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("admin.org.create");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = (await request.json()) as AdminOrgProvisionInput;
    const result = await createAdminOrgUnit(
      body,
      buildAdminMutationContext(request, auth.profile),
    );

    return NextResponse.json({
      ok: true,
      action: result.action,
      data: {
        orgUnit: result.orgUnit,
      },
    });
  } catch (error) {
    if (isAdminStoreError(error)) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
