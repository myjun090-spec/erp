import {
  createHash,
  createPublicKey,
  randomBytes,
  verify as verifySignature,
} from "node:crypto";
import {
  decodeSignedPayload,
  encodeSignedPayload,
  type AuthSessionPayload,
} from "@/lib/auth-session";
import { findAdminAuthContextByEmail } from "@/lib/admin-store";
import {
  buildViewerProfile,
  isAppRole,
  type AppRole,
} from "@/lib/navigation";
import { expandPermissionCodes } from "@/lib/permission-catalog";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type GoogleStatePayload = {
  version: 1;
  state: string;
  nonce: string;
  codeVerifier: string;
  next: string;
  expiresAt: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type GoogleIdTokenPayload = {
  aud: string | string[];
  email?: string;
  email_verified?: boolean;
  exp: number;
  hd?: string;
  iat: number;
  iss: string;
  name?: string;
  nonce?: string;
  picture?: string;
  sub: string;
};

type GoogleJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  hostedDomain: string | null;
  defaultRole: AppRole;
  platformAdminEmails: Set<string>;
  domainLeadEmails: Set<string>;
  executiveEmails: Set<string>;
};

type GoogleUserContext = {
  sessionPayload: AuthSessionPayload;
  matchedUserId: string | null;
  matchedRoleCode: string | null;
  matchedPolicyCodes: string[];
};

let jwksCache:
  | {
      expiresAt: number;
      keys: GoogleJwk[];
    }
  | null = null;

function parseCsvEnv(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseTokenPart<T>(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return JSON.parse(
    Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64").toString("utf8"),
  ) as T;
}

function base64UrlBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64");
}

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/")) {
    return "/dashboard";
  }

  return next;
}

function getRoleFromEnv(email: string, config: GoogleConfig) {
  if (config.platformAdminEmails.has(email)) {
    return "platform_admin" as const;
  }

  if (config.domainLeadEmails.has(email)) {
    return "domain_lead" as const;
  }

  if (config.executiveEmails.has(email)) {
    return "executive" as const;
  }

  return null;
}

function getRoleFromDirectory(input: {
  matchedUserRoleCode?: string | null;
  matchedRoleCode?: string | null;
  matchedRolePermissions?: string[] | null;
}) {
  const roleCode = (input.matchedRoleCode ?? input.matchedUserRoleCode ?? "").toUpperCase();
  const permissions = new Set(
    (input.matchedRolePermissions ?? []).map((permission) => permission.toLowerCase()),
  );
  const hasMutationPermission = [...permissions].some((permission) => {
    if (permission.endsWith(".write")) {
      return true;
    }

    if (permission.endsWith(".read")) {
      return false;
    }

    return !["navigation.search", "notifications.read", "personalization.read"].includes(permission);
  });

  if (
    roleCode.includes("PLATFORM") ||
    permissions.has("admin.read") ||
    permissions.has("admin.write") ||
    [...permissions].some((permission) => permission.startsWith("admin."))
  ) {
    return "platform_admin" as const;
  }

  if (
    permissions.has("dashboard.read") &&
    permissions.has("workspace.read") &&
    !hasMutationPermission
  ) {
    return "executive" as const;
  }

  if (roleCode || permissions.size > 0) {
    return "domain_lead" as const;
  }

  return null;
}

export function getGoogleAuthConfig(origin?: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const baseUrl = origin ?? process.env.APP_BASE_URL?.trim() ?? null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ??
    (baseUrl ? `${baseUrl}/auth/google/callback` : null);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  const defaultRole = process.env.GOOGLE_DEFAULT_ROLE?.trim();

  return {
    clientId,
    clientSecret,
    redirectUri,
    hostedDomain: process.env.GOOGLE_HOSTED_DOMAIN?.trim().toLowerCase() ?? null,
    defaultRole: isAppRole(defaultRole) ? defaultRole : "executive",
    platformAdminEmails: parseCsvEnv(process.env.GOOGLE_PLATFORM_ADMIN_EMAILS),
    domainLeadEmails: parseCsvEnv(process.env.GOOGLE_DOMAIN_LEAD_EMAILS),
    executiveEmails: parseCsvEnv(process.env.GOOGLE_EXECUTIVE_EMAILS),
  };
}

export function getGoogleAuthStatus(origin?: string) {
  const missing = [
    !process.env.ERP_AUTH_SECRET?.trim() ? "ERP_AUTH_SECRET" : null,
    !process.env.GOOGLE_CLIENT_ID?.trim() ? "GOOGLE_CLIENT_ID" : null,
    !process.env.GOOGLE_CLIENT_SECRET?.trim() ? "GOOGLE_CLIENT_SECRET" : null,
    !(
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      (origin && origin.startsWith("http"))
    )
      ? "GOOGLE_REDIRECT_URI 또는 APP origin"
      : null,
  ].filter(Boolean) as string[];

  const config = getGoogleAuthConfig(origin);

  return {
    enabled: missing.length === 0 && Boolean(config),
    missing,
    redirectUri: config?.redirectUri ?? null,
    hostedDomain: config?.hostedDomain ?? null,
    defaultRole: config?.defaultRole ?? "executive",
  };
}

export function createGoogleAuthorizationRequest(input: {
  origin: string;
  next: string | null;
}) {
  const config = getGoogleAuthConfig(input.origin);

  if (!config) {
    throw new Error("Google auth is not configured.");
  }

  const state = randomBytes(18).toString("base64url");
  const nonce = randomBytes(18).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const next = sanitizeNextPath(input.next);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  });

  if (config.hostedDomain) {
    params.set("hd", config.hostedDomain);
  }

  const statePayload: GoogleStatePayload = {
    version: 1,
    state,
    nonce,
    codeVerifier,
    next,
    expiresAt: Date.now() + STATE_MAX_AGE_MS,
  };

  return {
    authorizationUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    stateCookieValue: encodeSignedPayload(statePayload),
    next,
  };
}

export function parseGoogleState(cookieValue: string | undefined | null) {
  const payload = decodeSignedPayload<GoogleStatePayload>(cookieValue);

  if (!payload || payload.version !== 1) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

async function exchangeAuthorizationCode(input: {
  origin: string;
  code: string;
  codeVerifier: string;
}) {
  const config = getGoogleAuthConfig(input.origin);

  if (!config) {
    throw new Error("Google auth is not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !data.id_token) {
    throw new Error(data.error_description ?? data.error ?? "Google token exchange failed.");
  }

  return data;
}

async function getGoogleJwks() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to fetch Google JWKS.");
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const data = (await response.json()) as { keys?: GoogleJwk[] };

  if (!data.keys?.length) {
    throw new Error("Google JWKS payload is empty.");
  }

  jwksCache = {
    keys: data.keys,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };

  return data.keys;
}

async function verifyGoogleIdToken(input: {
  origin: string;
  idToken: string;
  nonce: string;
}) {
  const config = getGoogleAuthConfig(input.origin);

  if (!config) {
    throw new Error("Google auth is not configured.");
  }

  const [headerPart, payloadPart, signaturePart] = input.idToken.split(".");

  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error("Malformed Google ID token.");
  }

  const header = parseTokenPart<GoogleIdTokenHeader>(headerPart);
  const payload = parseTokenPart<GoogleIdTokenPayload>(payloadPart);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Google ID token algorithm.");
  }

  const jwks = await getGoogleJwks();
  const jwk = jwks.find((item) => item.kid === header.kid);

  if (!jwk) {
    throw new Error("Matching Google signing key was not found.");
  }

  const publicKeyInput = {
    key: jwk,
    format: "jwk" as const,
  } as Parameters<typeof createPublicKey>[0];
  const publicKey = createPublicKey(publicKeyInput);
  const verified = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    base64UrlBuffer(signaturePart),
  );

  if (!verified) {
    throw new Error("Google ID token signature verification failed.");
  }

  if (
    payload.iss !== "https://accounts.google.com" &&
    payload.iss !== "accounts.google.com"
  ) {
    throw new Error("Unexpected Google issuer.");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (!audiences.includes(config.clientId)) {
    throw new Error("Google audience does not match the configured client.");
  }

  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("Google ID token has expired.");
  }

  if (payload.nonce !== input.nonce) {
    throw new Error("Google nonce validation failed.");
  }

  if (!payload.email || payload.email_verified !== true) {
    throw new Error("Verified Google email is required.");
  }

  if (config.hostedDomain && payload.hd?.toLowerCase() !== config.hostedDomain) {
    throw new Error("Google hosted domain does not match.");
  }

  return payload;
}

export async function resolveGoogleUserContext(input: {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  hostedDomain?: string;
}): Promise<GoogleUserContext | null> {
  const email = input.email.toLowerCase();
  const config = getGoogleAuthConfig();

  if (!config) {
    return null;
  }

  const authContext = await findAdminAuthContextByEmail(email);
  const matchedUser = authContext.user;
  const matchedRole = authContext.role;
  const matchedOrg = authContext.orgUnit;
  const matchedPolicyCodes = authContext.policyCodes;

  if (matchedUser?.state === "잠금" || matchedUser?.state === "비활성") {
    return null;
  }

  if (matchedRole?.state === "비활성") {
    return null;
  }

  const explicitRole = getRoleFromEnv(email, config);

  let role: AppRole | null = explicitRole;

  if (!role && matchedUser) {
    role = getRoleFromDirectory({
      matchedUserRoleCode: matchedUser.roleCode,
      matchedRoleCode: matchedRole?.code ?? null,
      matchedRolePermissions: matchedRole?.permissions ?? null,
    });
  }

  if (!role) {
    return null;
  }

  const roleTemplate = buildViewerProfile(role);
  const effectivePermissions = expandPermissionCodes(
    matchedRole?.permissions ?? roleTemplate.permissions,
  );

  return {
    sessionPayload: {
      version: 1,
      provider: "google",
      role,
      email,
      displayName: input.name ?? matchedUser?.name ?? roleTemplate.displayName,
      orgUnitName:
        matchedOrg?.name ?? matchedUser?.orgUnitName ?? roleTemplate.orgUnitName,
      permissions: effectivePermissions,
      roleCode: matchedRole?.code ?? matchedUser?.roleCode ?? undefined,
      sub: input.sub,
      avatarUrl: input.picture,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    },
    matchedUserId: matchedUser?.id ?? null,
    matchedRoleCode: matchedRole?.code ?? null,
    matchedPolicyCodes,
  };
}

export async function finalizeGoogleLogin(input: {
  origin: string;
  code: string;
  nonce: string;
  codeVerifier: string;
}) {
  const tokenResponse = await exchangeAuthorizationCode({
    origin: input.origin,
    code: input.code,
    codeVerifier: input.codeVerifier,
  });
  const tokenPayload = await verifyGoogleIdToken({
    origin: input.origin,
    idToken: tokenResponse.id_token!,
    nonce: input.nonce,
  });
  const userContext = await resolveGoogleUserContext({
    email: tokenPayload.email!,
    sub: tokenPayload.sub,
    name: tokenPayload.name,
    picture: tokenPayload.picture,
    hostedDomain: tokenPayload.hd,
  });

  if (!userContext) {
    throw new Error("허용되지 않은 Google 계정입니다.");
  }

  return userContext;
}
