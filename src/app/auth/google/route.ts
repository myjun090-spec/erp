import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { googleStateCookieName } from "@/lib/auth-session";
import {
  createGoogleAuthorizationRequest,
  getGoogleAuthStatus,
} from "@/lib/google-auth";

export function GET(request: NextRequest) {
  const status = getGoogleAuthStatus(request.nextUrl.origin);
  const loginUrl = new URL("/login", request.url);

  if (!status.enabled) {
    loginUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const { authorizationUrl, stateCookieValue, next } = createGoogleAuthorizationRequest({
    origin: request.nextUrl.origin,
    next: request.nextUrl.searchParams.get("next"),
  });
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set({
    name: googleStateCookieName,
    value: stateCookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + 10 * 60 * 1000),
  });

  if (next.startsWith("/")) {
    loginUrl.searchParams.set("next", next);
  }

  return response;
}
