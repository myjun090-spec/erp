"use client";

import { useEffect, useState } from "react";
import { ViewerPermissionsProvider } from "@/components/auth/viewer-permissions-context";
import { ProjectSelectionProvider } from "@/components/layout/project-selection-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastProvider } from "@/components/ui/toast-provider";

const sidebarStorageKey = "smr-erp.sidebar-collapsed.v1";

type AppShellProps = {
  children: React.ReactNode;
  viewer: {
    displayName: string;
    orgUnitName: string;
    email: string;
    role: string;
    permissions: string[];
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      tone: "info" | "warning" | "success";
    }>;
    favoriteItems: Array<{ title: string; href: string }>;
    recentItems: Array<{ title: string; href: string }>;
    savedViews: Array<{ id: string; title: string; href: string; description: string }>;
    navigationGroups: Array<{
      title: string;
      items: Array<{
        title: string;
        href: string;
        caption: string;
        phase: string;
      }>;
    }>;
    accessibleItems: Array<{ title: string; href: string; caption: string }>;
    searchableItems?: Array<{ title: string; href: string; caption: string }>;
    teamProgress: Array<{
      label: string;
      value: string;
      tone: "info" | "warning" | "success";
    }>;
  };
};

export function AppShell({ children, viewer }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(sidebarStorageKey) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <ToastProvider>
      <ViewerPermissionsProvider permissions={viewer.permissions}>
        <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
          <div className="flex min-h-screen">
            <ProjectSelectionProvider>
              <Sidebar
                groups={viewer.navigationGroups}
                favorites={viewer.favoriteItems}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar
                  viewer={viewer}
                  searchableItems={viewer.searchableItems ?? viewer.accessibleItems}
                />
                <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
                  <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
                    {children}
                  </div>
                </main>
              </div>
            </ProjectSelectionProvider>
          </div>
        </div>
      </ViewerPermissionsProvider>
    </ToastProvider>
  );
}
