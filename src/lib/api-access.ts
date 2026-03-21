import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildViewerProfile,
  hasPermission,
} from "@/lib/navigation";
import { getSessionPayloadFromCookies } from "@/lib/auth-session";
import type { KnownPermissionCode, PermissionCode } from "@/lib/permission-catalog";

async function resolveApiPermissionProfile() {
  const cookieStore = await cookies();
  const sessionPayload = getSessionPayloadFromCookies(cookieStore);

  if (!sessionPayload) {
    return {
      error: NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  return {
    profile: buildViewerProfile(sessionPayload.role, {
      displayName: sessionPayload.displayName,
      orgUnitName: sessionPayload.orgUnitName,
      email: sessionPayload.email,
      permissions: sessionPayload.permissions,
    }),
  };
}

export async function requireApiPermission(permission: PermissionCode) {
  const auth = await resolveApiPermissionProfile();

  if ("error" in auth) {
    return auth;
  }

  if (!hasPermission(auth.profile.permissions, permission)) {
    return {
      error: NextResponse.json(
        { message: "해당 API 접근 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }

  return auth;
}

export async function requireAnyApiPermission(permissions: PermissionCode[]) {
  const auth = await resolveApiPermissionProfile();

  if ("error" in auth) {
    return auth;
  }

  if (!permissions.some((permission) => hasPermission(auth.profile.permissions, permission))) {
    return {
      error: NextResponse.json(
        { message: "해당 API 접근 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }

  return auth;
}

export async function requireApiActionPermission(permission: KnownPermissionCode) {
  const auth = await resolveApiPermissionProfile();

  if ("error" in auth) {
    return auth;
  }

  if (!hasPermission(auth.profile.permissions, permission)) {
    return {
      error: NextResponse.json(
        { message: "해당 API 접근 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }

  return auth;
}

export async function requireAnyApiActionPermission(
  permissions: KnownPermissionCode[],
) {
  const auth = await resolveApiPermissionProfile();

  if ("error" in auth) {
    return auth;
  }

  if (!permissions.some((permission) => hasPermission(auth.profile.permissions, permission))) {
    return {
      error: NextResponse.json(
        { message: "해당 API 접근 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }

  return auth;
}
