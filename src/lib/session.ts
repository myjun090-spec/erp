import { cookies } from "next/headers";
import {
  buildViewerProfile,
  canAccessHref,
  getAccessibleItems,
  getFavoriteItems,
  getNavigationByPermissions,
  getRecentItems,
  getSearchableRouteItems,
  getTeamProgress,
} from "@/lib/navigation";
import { getSessionPayloadFromCookies } from "@/lib/auth-session";
import { getPersonalizationFromStore } from "@/lib/platform-store";

function dedupeSearchItems<T extends { href: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.href)) {
      return false;
    }

    seen.add(item.href);
    return true;
  });
}

export async function getCurrentViewer() {
  const cookieStore = await cookies();
  const sessionPayload = getSessionPayloadFromCookies(cookieStore);

  if (!sessionPayload) {
    return null;
  }

  const profile = buildViewerProfile(sessionPayload.role, {
    displayName: sessionPayload.displayName,
    orgUnitName: sessionPayload.orgUnitName,
    email: sessionPayload.email,
    permissions: sessionPayload.permissions,
  });
  const accessibleItems = getAccessibleItems(profile.permissions);
  const searchableRouteItems = getSearchableRouteItems(profile.permissions);
  const personalization = await getPersonalizationFromStore({
    role: profile.role,
    email: sessionPayload.email,
  });
  const isAccessibleHref = (href: string) => canAccessHref(profile.permissions, href);
  const savedViews = personalization.savedViews.filter((view) =>
    isAccessibleHref(view.href),
  );
  const searchableSavedViews = savedViews
    .map((view) => ({
      title: view.title,
      href: view.href,
      caption: `Saved view · ${view.description}`,
    }))
    .filter((item) => isAccessibleHref(item.href));

  return {
    ...profile,
    provider: sessionPayload.provider,
    avatarUrl: sessionPayload.avatarUrl ?? null,
    permissions: profile.permissions,
    navigationGroups: getNavigationByPermissions(profile.permissions),
    accessibleItems: accessibleItems,
    favoriteItems: getFavoriteItems(profile),
    recentItems: getRecentItems(profile),
    savedViews,
    notifications: personalization.notifications,
    searchableItems: dedupeSearchItems([
      ...accessibleItems,
      ...searchableRouteItems,
      ...searchableSavedViews,
    ]),
    teamProgress: getTeamProgress(profile.role),
  };
}
