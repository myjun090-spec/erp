import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  createAdminUser,
  isAdminStoreError,
  type AdminUserProvisionInput,
} from "@/lib/admin-store";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("admin.user.create");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = (await request.json()) as AdminUserProvisionInput;
    const result = await createAdminUser(
      body,
      buildAdminMutationContext(request, auth.profile),
    );

    return NextResponse.json({
      ok: true,
      action: result.action,
      data: {
        user: result.user,
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
