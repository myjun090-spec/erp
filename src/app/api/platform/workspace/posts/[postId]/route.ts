import { NextResponse } from "next/server";
import { requireApiActionPermission, requireApiPermission } from "@/lib/api-access";
import { isMongoConfigured } from "@/lib/mongodb";
import { getRequiredPermissionForPath } from "@/lib/navigation";
import {
  archiveWorkspacePostInStore,
  getWorkspacePostDetailFromStore,
  getWorkspaceOwnerOptionsFromStore,
  isWorkspaceOwnerInStore,
  updateWorkspacePostInStore,
} from "@/lib/platform-store";
import { buildWorkspaceMenuOptions } from "@/lib/workspace-navigation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const result = await requireApiPermission("workspace.read");

  if ("error" in result) {
    return result.error;
  }

  const { postId } = await context.params;
  const [detail, ownerOptionsResult] = await Promise.all([
    getWorkspacePostDetailFromStore({ postId, role: result.profile.role }),
    getWorkspaceOwnerOptionsFromStore(),
  ]);

  if (!detail) {
    return NextResponse.json(
      { ok: false, message: "해당 게시물을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    source: detail.source,
    data: {
      post: detail.post,
      relatedPosts: detail.relatedPosts,
      ownerOptions: ownerOptionsResult.ownerOptions,
      menuOptions: buildWorkspaceMenuOptions(result.profile.permissions),
      versionHistory: detail.versionHistory,
      accessHistory: detail.accessHistory,
    },
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const auth = await requireApiActionPermission("workspace-post.update");
  if ("error" in auth) return auth.error;

  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, message: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  try {
    const { postId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const data: {
      title?: string;
      owner?: string;
      linkedMenuHref?: string;
      linkedMenuLabel?: string;
      linkedPermission?: ReturnType<typeof getRequiredPermissionForPath>;
      documentRef?: string;
    } = {};
    if (typeof body.title === "string") data.title = body.title;
    if (typeof body.owner === "string") {
      const owner = body.owner.trim();
      if (!owner) {
        return NextResponse.json({ ok: false, message: "담당 조직을 선택해 주세요." }, { status: 400 });
      }
      if (!(await isWorkspaceOwnerInStore(owner))) {
        return NextResponse.json({ ok: false, message: "허용된 담당 조직만 선택할 수 있습니다." }, { status: 400 });
      }
      data.owner = owner;
    }
    if (typeof body.linkedMenuHref === "string") {
      const linkedMenuHref = body.linkedMenuHref.trim();
      if (!linkedMenuHref) {
        return NextResponse.json({ ok: false, message: "연결 메뉴를 선택해 주세요." }, { status: 400 });
      }
      const menuOptions = buildWorkspaceMenuOptions(auth.profile.permissions);
      const matchedMenu = menuOptions.find((option) => option.value === linkedMenuHref);
      if (!matchedMenu) {
        return NextResponse.json({ ok: false, message: "허용된 연결 메뉴만 선택할 수 있습니다." }, { status: 400 });
      }
      data.linkedMenuHref = linkedMenuHref;
      data.linkedMenuLabel = matchedMenu.label;
      data.linkedPermission = getRequiredPermissionForPath(linkedMenuHref);
    }
    if (typeof body.documentRef === "string") data.documentRef = body.documentRef;

    await updateWorkspacePostInStore(postId, {
      ...data,
      actorName: auth.profile.displayName,
      actorTeam: auth.profile.orgUnitName,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const auth = await requireApiActionPermission("workspace-post.archive");
  if ("error" in auth) return auth.error;

  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, message: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  try {
    const { postId } = await context.params;
    await archiveWorkspacePostInStore({
      id: postId,
      actorName: auth.profile.displayName,
      actorTeam: auth.profile.orgUnitName,
    });
    return NextResponse.json({ ok: true, archived: true });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
