import { NextRequest, NextResponse } from "next/server";
import { clearTransientAuthCookies, createSessionPayload, applySessionCookie } from "@/lib/auth-session";
import { buildViewerProfile, isAppRole } from "@/lib/navigation";

export function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");
  const next = request.nextUrl.searchParams.get("next") || "/dashboard";

  if (!isAppRole(role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  clearTransientAuthCookies(response);
  const profile = buildViewerProfile(role);

  applySessionCookie(
    response,
    createSessionPayload({
      provider: "preview",
      role,
      email: profile.email,
      displayName: profile.displayName,
      orgUnitName: profile.orgUnitName,
      sub: `preview:${role}`,
    }),
  );

  return response;
}
