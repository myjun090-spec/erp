import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  createAdminRole,
  isAdminStoreError,
  type AdminRoleProvisionInput,
} from "@/lib/admin-store";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("admin.role.create");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = (await request.json()) as AdminRoleProvisionInput;
    const result = await createAdminRole(
      body,
      buildAdminMutationContext(request, auth.profile),
    );

    return NextResponse.json({
      ok: true,
      action: result.action,
      data: {
        role: result.role,
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
