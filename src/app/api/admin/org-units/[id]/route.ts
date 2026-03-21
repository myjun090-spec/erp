import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  isAdminStoreError,
  updateAdminOrgUnit,
  type AdminOrgProvisionInput,
} from "@/lib/admin-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiActionPermission("admin.org.update");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as AdminOrgProvisionInput;
    const result = await updateAdminOrgUnit(
      id,
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
