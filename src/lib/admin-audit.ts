import type { ViewerProfile } from "@/lib/navigation";
import type { AdminMutationContext } from "@/lib/admin-store";

export function buildAdminMutationContext(
  request: Request,
  profile: Pick<ViewerProfile, "displayName" | "orgUnitName" | "email">,
): AdminMutationContext {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

  return {
    actor: {
      displayName: profile.displayName,
      orgUnitName: profile.orgUnitName,
      email: profile.email,
    },
    route: "/admin",
    ipAddress,
  };
}
