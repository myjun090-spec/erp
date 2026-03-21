import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { isMongoConfigured } from "@/lib/mongodb";
import { transitionWorkspacePostInStore } from "@/lib/platform-store";
import type { WorkspacePostAction } from "@/lib/workspace-post-status";

function isWorkspacePostAction(value: unknown): value is WorkspacePostAction {
  return (
    value === "request-review" ||
    value === "cancel-review" ||
    value === "reject-review" ||
    value === "publish" ||
    value === "archive" ||
    value === "restore"
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!isWorkspacePostAction(action)) {
      return NextResponse.json(
        { ok: false, message: "허용되지 않는 작업입니다." },
        { status: 400 },
      );
    }

    const requiredPermission =
      action === "request-review" || action === "cancel-review"
        ? "workspace-post.request-review"
        : action === "reject-review"
          ? "workspace-post.reject"
          : action === "publish"
            ? "workspace-post.approve"
            : action === "archive"
              ? "workspace-post.archive"
              : "workspace-post.restore";

    const auth = await requireApiActionPermission(requiredPermission);
    if ("error" in auth) return auth.error;

    if (!isMongoConfigured()) {
      return NextResponse.json(
        { ok: false, message: "데이터베이스가 연결되지 않았습니다." },
        { status: 503 },
      );
    }

    const post = await transitionWorkspacePostInStore({
      id: postId,
      action,
      actorName: auth.profile.displayName,
      actorTeam: auth.profile.orgUnitName,
      reason,
    });

    return NextResponse.json({ ok: true, data: post });
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
