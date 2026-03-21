import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import {
  buildViewerProfile,
  isAppRole,
  roleCookieName,
  type AppRole,
} from "@/lib/navigation";
import type { KnownPermissionCode } from "@/lib/permission-catalog";

export const sessionCookieName = "erp_session";
export const googleStateCookieName = "erp_google_state";

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type AuthProvider = "preview" | "google";

export type AuthSessionPayload = {
  version: 1;
  provider: AuthProvider;
  role: AppRole;
  email: string;
  displayName: string;
  orgUnitName: string;
  permissions?: KnownPermissionCode[];
  roleCode?: string;
  sub: string;
  avatarUrl?: string;
  issuedAt: number;
  expiresAt: number;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function getAuthSecret() {
  const secret = process.env.ERP_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("ERP_AUTH_SECRET is not configured.");
  }

  return secret;
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64");
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest();
}

export function encodeSignedPayload(payload: unknown) {
  const json = JSON.stringify(payload);
  const compressed = brotliCompressSync(Buffer.from(json, "utf8"));
  const encodedPayload = `br:${base64UrlEncode(compressed)}`;
  const encodedSignature = base64UrlEncode(signValue(encodedPayload));
  return `${encodedPayload}.${encodedSignature}`;
}

export function decodeSignedPayload<T>(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, encodedSignature] = value.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const providedSignature = base64UrlDecode(encodedSignature);

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  try {
    if (encodedPayload.startsWith("br:")) {
      const compressedPayload = encodedPayload.slice(3);
      const decompressed = brotliDecompressSync(base64UrlDecode(compressedPayload));
      return JSON.parse(decompressed.toString("utf8")) as T;
    }

    return JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createSessionPayload(input: {
  provider: AuthProvider;
  role: AppRole;
  email: string;
  displayName: string;
  orgUnitName: string;
  permissions?: KnownPermissionCode[];
  roleCode?: string;
  sub: string;
  avatarUrl?: string;
}) {
  const issuedAt = Date.now();

  return {
    version: 1 as const,
    ...input,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_MS,
  };
}

export function parseSessionPayload(
  cookieValue: string | undefined | null,
): AuthSessionPayload | null {
  const payload = decodeSignedPayload<AuthSessionPayload>(cookieValue);

  if (!payload || payload.version !== 1 || !isAppRole(payload.role)) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function getSessionPayloadFromCookies(cookieReader: CookieReader) {
  const sessionPayload = parseSessionPayload(
    cookieReader.get(sessionCookieName)?.value,
  );

  if (sessionPayload) {
    return sessionPayload;
  }

  const previewRole = cookieReader.get(roleCookieName)?.value;

  if (!isAppRole(previewRole)) {
    return null;
  }

  const previewProfile = buildViewerProfile(previewRole);

  return createSessionPayload({
    provider: "preview",
    role: previewRole,
    email: previewProfile.email,
    displayName: previewProfile.displayName,
    orgUnitName: previewProfile.orgUnitName,
    permissions: previewProfile.permissions,
    sub: `preview:${previewRole}`,
  });
}

export function applySessionCookie(
  response: NextResponse,
  sessionPayload: AuthSessionPayload,
) {
  response.cookies.set({
    name: sessionCookieName,
    value: encodeSignedPayload(sessionPayload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(sessionPayload.expiresAt),
  });
}

export function clearAuthCookies(response: NextResponse) {
  const expiredAt = new Date(0);

  response.cookies.set({
    name: sessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiredAt,
  });
  clearTransientAuthCookies(response);
}

export function clearTransientAuthCookies(response: NextResponse) {
  const expiredAt = new Date(0);

  response.cookies.set({
    name: roleCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiredAt,
  });
  response.cookies.set({
    name: googleStateCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiredAt,
  });
}
