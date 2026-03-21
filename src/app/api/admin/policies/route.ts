import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  createAdminPolicy,
  isAdminStoreError,
  type AdminPolicyProvisionInput,
} from "@/lib/admin-store";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("admin.policy.create");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = (await request.json()) as AdminPolicyProvisionInput;
    const result = await createAdminPolicy(
      body,
      buildAdminMutationContext(request, auth.profile),
    );

    return NextResponse.json({
      ok: true,
      action: result.action,
      data: {
        policy: result.policy,
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
