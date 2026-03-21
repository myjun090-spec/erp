import { NextResponse } from "next/server";
import { requireApiActionPermission } from "@/lib/api-access";
import { isMongoConfigured } from "@/lib/mongodb";
import { getRequiredPermissionForPath } from "@/lib/navigation";
import {
  createWorkspacePostInStore,
  isWorkspaceOwnerInStore,
} from "@/lib/platform-store";
import { buildWorkspaceMenuOptions } from "@/lib/workspace-navigation";

export async function POST(request: Request) {
  const auth = await requireApiActionPermission("workspace-post.create");
  if ("error" in auth) return auth.error;

  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, message: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const kind = body.kind === "library" ? "library" : "notice";
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const linkedMenuHref = typeof body.linkedMenuHref === "string" ? body.linkedMenuHref.trim() : "";
    const documentRef = typeof body.documentRef === "string" ? body.documentRef.trim() : "";

    if (!title) {
      return NextResponse.json({ ok: false, message: "제목을 입력해 주세요." }, { status: 400 });
    }
    if (!owner) {
      return NextResponse.json({ ok: false, message: "담당 조직을 선택해 주세요." }, { status: 400 });
    }
    if (!(await isWorkspaceOwnerInStore(owner))) {
      return NextResponse.json({ ok: false, message: "허용된 담당 조직만 선택할 수 있습니다." }, { status: 400 });
    }
    if (!linkedMenuHref) {
      return NextResponse.json({ ok: false, message: "연결 메뉴를 선택해 주세요." }, { status: 400 });
    }

    const menuOptions = buildWorkspaceMenuOptions(auth.profile.permissions);
    const matchedMenu = menuOptions.find((option) => option.value === linkedMenuHref);
    if (!matchedMenu) {
      return NextResponse.json({ ok: false, message: "허용된 연결 메뉴만 선택할 수 있습니다." }, { status: 400 });
    }

    const post = await createWorkspacePostInStore({
      title,
      kind,
      owner,
      linkedMenuHref,
      linkedMenuLabel: matchedMenu.label,
      linkedPermission: getRequiredPermissionForPath(linkedMenuHref),
      documentRef,
      actorName: auth.profile.displayName,
      actorTeam: auth.profile.orgUnitName,
    });
    return NextResponse.json({ ok: true, data: post }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
