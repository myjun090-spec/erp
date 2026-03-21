import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { isMongoConfigured } from "@/lib/mongodb";
import { logWorkspacePostAccessInStore } from "@/lib/platform-store";
import type { WorkspacePostAccessRecord } from "@/lib/platform-catalog";

function isWorkspacePostAccessAction(
  value: unknown,
): value is WorkspacePostAccessRecord["action"] {
  return value === "view" || value === "ref-copy";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const auth = await requireApiPermission("workspace.read");
  if ("error" in auth) return auth.error;

  if (!isMongoConfigured()) {
    return NextResponse.json(
      { ok: false, message: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 },
    );
  }

  try {
    const { postId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (!isWorkspacePostAccessAction(action)) {
      return NextResponse.json(
        { ok: false, message: "허용되지 않는 이벤트입니다." },
        { status: 400 },
      );
    }

    await logWorkspacePostAccessInStore({
      id: postId,
      action,
      actorName: auth.profile.displayName,
      actorTeam: auth.profile.orgUnitName,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
