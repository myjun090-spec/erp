import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  applySessionCookie,
  clearTransientAuthCookies,
  googleStateCookieName,
} from "@/lib/auth-session";
import { finalizeGoogleLogin, parseGoogleState } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    loginUrl.searchParams.set("error", error);
    return NextResponse.redirect(loginUrl);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(googleStateCookieName)?.value;
  const statePayload = parseGoogleState(stateCookie);

  if (!code || !state || !statePayload || statePayload.state !== state) {
    loginUrl.searchParams.set("error", "google_state_invalid");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const userContext = await finalizeGoogleLogin({
      origin: request.nextUrl.origin,
      code,
      nonce: statePayload.nonce,
      codeVerifier: statePayload.codeVerifier,
    });
    const response = NextResponse.redirect(
      new URL(statePayload.next, request.url),
    );

    clearTransientAuthCookies(response);
    applySessionCookie(response, userContext.sessionPayload);

    return response;
  } catch (cause) {
    loginUrl.searchParams.set("error", "google_login_failed");
    loginUrl.searchParams.set(
      "message",
      cause instanceof Error ? cause.message : "Google login failed.",
    );
    return NextResponse.redirect(loginUrl);
  }
}
