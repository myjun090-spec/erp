import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionPayloadFromCookies } from "@/lib/auth-session";

export async function GET() {
  const cookieStore = await cookies();
  const session = getSessionPayloadFromCookies(cookieStore);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    data: {
      displayName: session.displayName ?? "",
      orgUnitName: session.orgUnitName ?? "",
      email: session.email ?? "",
      role: session.role ?? "",
      roleCode: session.roleCode ?? "",
      permissions: session.permissions ?? [],
    },
  });
}
