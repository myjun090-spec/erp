import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildViewerProfile,
  getRequiredPermissionForPath,
  hasPermission,
} from "@/lib/navigation";
import { getSessionPayloadFromCookies } from "@/lib/auth-session";

const PUBLIC_PATHS = [
  "/login",
  "/unauthorized",
  "/auth/google",
  "/auth/google/callback",
  "/auth/login",
  "/auth/logout",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPrefetchRequest =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|svg|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((publicPath) => pathname === publicPath)) {
    return NextResponse.next();
  }

  const requiredPermission = getRequiredPermissionForPath(
    `${pathname}${request.nextUrl.search}`,
  );

  if (!requiredPermission) {
    return NextResponse.next();
  }

  const sessionPayload = getSessionPayloadFromCookies(request.cookies);

  if (!sessionPayload) {
    if (isPrefetchRequest) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const profile = buildViewerProfile(sessionPayload.role, {
    displayName: sessionPayload.displayName,
    orgUnitName: sessionPayload.orgUnitName,
    email: sessionPayload.email,
    permissions: sessionPayload.permissions,
  });

  if (!hasPermission(profile.permissions, requiredPermission)) {
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    unauthorizedUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(unauthorizedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
