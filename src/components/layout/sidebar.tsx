"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { cn } from "@/lib/cn";

type SidebarProps = {
  groups: Array<{
    title: string;
    items: Array<{
      title: string;
      href: string;
      caption: string;
      phase: string;
    }>;
  }>;
  favorites: Array<{
    title: string;
    href: string;
  }>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function getItemMonogram(title: string) {
  return title.replace(/\s+/g, "").slice(0, 2).toUpperCase();
}

export function Sidebar({
  groups,
  favorites,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const {
    currentProject,
    currentProjectId,
    projects,
    projectsLoading,
    setCurrentProjectId,
  } = useProjectSelection();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(242,247,255,0.96))] text-[color:var(--sidebar-ink)] transition-[width] duration-300 xl:flex",
        collapsed ? "w-[106px]" : "w-[294px]",
      )}
      style={{ borderColor: "var(--sidebar-border)" }}
    >
      <div
        className={cn(
          "border-b px-4 py-5",
          collapsed ? "px-3" : "px-5",
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0", collapsed && "w-full")}>
            <div className="text-xs font-semibold tracking-[0.22em] uppercase text-[color:var(--sidebar-muted)]">
              Workspace
            </div>
            <div className={cn("mt-3", collapsed && "mt-4 text-center")}>
              <div className="text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sidebar-ink)]">
                {collapsed ? "ERP" : "SMR ERP"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-[color:var(--sidebar-ink)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
            style={{ borderColor: "var(--sidebar-border)" }}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-pressed={collapsed}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
        <div
          className={cn(
            "mt-5",
            collapsed ? "grid grid-cols-1 gap-2" : "space-y-3",
          )}
        >
          {collapsed ? (
            <div
              title={currentProject ? `${currentProject.name} (${currentProject.code})` : "전체 프로젝트"}
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border bg-white text-[11px] font-semibold tracking-[0.08em] text-[color:var(--primary)]"
              style={{ borderColor: "var(--sidebar-border)" }}
            >
              {currentProject?.code.slice(0, 2).toUpperCase() ?? "ALL"}
            </div>
          ) : (
            <div className="rounded-[22px] border bg-white/90 p-3 shadow-[0_10px_24px_rgba(12,102,228,0.08)]" style={{ borderColor: "var(--sidebar-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[color:var(--sidebar-muted)]">
                    Current Project
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--sidebar-ink)]">
                    {currentProject ? currentProject.name : "전체 프로젝트"}
                  </div>
                </div>
                <Link
                  href="/projects"
                  prefetch={false}
                  className="rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--primary)] transition hover:bg-[rgba(12,102,228,0.06)]"
                  style={{ borderColor: "var(--sidebar-border)" }}
                >
                  목록
                </Link>
              </div>
              <label className="mt-3 block">
                <span className="sr-only">현재 프로젝트 선택</span>
                <select
                  value={currentProjectId ?? ""}
                  onChange={(event) => setCurrentProjectId(event.target.value || null)}
                  disabled={projectsLoading}
                  className="w-full rounded-2xl border bg-[rgba(242,247,255,0.72)] px-3 py-2.5 text-sm font-medium text-[color:var(--sidebar-ink)] outline-none transition focus:border-[color:var(--primary)] disabled:cursor-wait disabled:opacity-70"
                  style={{ borderColor: "var(--sidebar-border)" }}
                  aria-label="현재 프로젝트 선택"
                >
                  <option value="">
                    {projectsLoading ? "프로젝트 불러오는 중..." : "전체 프로젝트"}
                  </option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name} ({project.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>
      <nav className={cn("flex-1 overflow-y-auto py-5", collapsed ? "px-2.5" : "px-4")}>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <div className="px-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--sidebar-muted)]">
                  {group.title}
                </div>
              ) : null}
              <div className="mt-3 space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      title={`${item.title} · ${item.caption}`}
                      className={cn(
                        "group block rounded-2xl border transition duration-200",
                        collapsed ? "px-2 py-2.5" : "px-4 py-3",
                        active
                          ? "bg-[color:var(--sidebar-active-surface)] shadow-[0_18px_36px_rgba(12,102,228,0.14)]"
                          : "hover:border-[color:var(--sidebar-hover-border)] hover:bg-[color:var(--sidebar-hover)] hover:shadow-[0_12px_26px_rgba(12,102,228,0.08)]",
                      )}
                      style={{
                        borderColor: active ? "var(--sidebar-active-border)" : "transparent",
                      }}
                    >
                      {collapsed ? (
                        <div className="flex items-center justify-center">
                          <div
                            className={cn(
                              "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold tracking-[0.08em] transition",
                              active
                                ? "bg-white text-[color:var(--primary)]"
                                : "bg-[rgba(12,102,228,0.08)] text-[color:var(--sidebar-ink)] group-hover:bg-white group-hover:text-[color:var(--primary)]",
                            )}
                          >
                            {getItemMonogram(item.title)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>
                            <div className="font-semibold tracking-[-0.02em] text-[color:var(--sidebar-ink)] transition group-hover:text-[color:var(--primary)]">
                              {item.title}
                            </div>
                            <div className="mt-1 text-sm text-[color:var(--sidebar-muted)]">
                              {item.caption}
                            </div>
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <div
        className={cn("border-t py-5", collapsed ? "px-2.5" : "px-5")}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {!collapsed ? (
          <>
            <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[color:var(--sidebar-muted)]">
              Favorites
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {favorites.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className="rounded-full border bg-white px-3 py-1.5 text-xs text-[color:var(--sidebar-ink)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                  style={{ borderColor: "var(--sidebar-border)" }}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            {favorites.slice(0, 3).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                title={item.title}
                className="flex h-10 items-center justify-center rounded-2xl border bg-white text-xs font-semibold text-[color:var(--sidebar-ink)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                style={{ borderColor: "var(--sidebar-border)" }}
              >
                {getItemMonogram(item.title)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
