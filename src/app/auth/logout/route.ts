import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-session";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearAuthCookies(response);
  return response;
}
