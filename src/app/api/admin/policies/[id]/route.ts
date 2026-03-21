import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildAdminMutationContext } from "@/lib/admin-audit";
import {
  isAdminStoreError,
  updateAdminPolicy,
  type AdminPolicyProvisionInput,
} from "@/lib/admin-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiActionPermission("admin.policy.update");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as AdminPolicyProvisionInput;
    const result = await updateAdminPolicy(
      id,
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
