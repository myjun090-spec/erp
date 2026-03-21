"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerDisplay } from "@/lib/number-input";

type SearchItem = {
  title: string;
  href: string;
  caption?: string;
};

type TopbarProps = {
  viewer: {
    displayName: string;
    orgUnitName: string;
    email: string;
    role: string;
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      tone: "info" | "warning" | "success";
    }>;
    favoriteItems: SearchItem[];
    recentItems: SearchItem[];
    savedViews: Array<{
      id: string;
      title: string;
      href: string;
      description: string;
    }>;
    navigationGroups: Array<{
      title: string;
      items: Array<{
        title: string;
        href: string;
        caption: string;
        phase: string;
      }>;
    }>;
    teamProgress: Array<{
      label: string;
      value: string;
      tone: "info" | "warning" | "success";
    }>;
  };
  searchableItems: SearchItem[];
};

export function Topbar({
  viewer,
  searchableItems,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchPanelId = useId();
  const searchRootRef = useRef<HTMLDivElement | null>(null);
  const notificationsRootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const { pushToast } = useToast();

  const quickCreateItems =
    viewer.role === "platform_admin"
      ? [
          {
            title: "공지 등록",
            description: "워크스페이스 공지 초안 작성으로 바로 이동합니다.",
            href: "/workspace",
          },
          {
            title: "관리자 정책 검토",
            description: "조직, 역할, 정책 관리 화면으로 이동합니다.",
            href: "/admin",
          },
          {
            title: "현황 브리프 확인",
            description: "대시보드 운영 브리프와 위젯 구성을 확인합니다.",
            href: "/dashboard",
          },
        ]
      : viewer.role === "domain_lead"
        ? [
            {
              title: "사업기회 등록",
              description: "사업개발 신규 기회 템플릿을 엽니다.",
              href: "/business-development/opportunities/new",
            },
            {
              title: "프로젝트 생성",
              description: "프로젝트 기본 정보 등록 화면으로 이동합니다.",
              href: "/projects/new",
            },
            {
              title: "예산 초안 작성",
              description: "실행예산 신규 입력 화면으로 이동합니다.",
              href: "/projects/execution-budgets/new",
            },
          ]
        : [
            {
              title: "현황판 보기",
              description: "경영 정보와 운영 현황 요약을 확인합니다.",
              href: "/dashboard",
            },
            {
              title: "공지 확인",
              description: "워크스페이스 최신 게시물을 확인합니다.",
              href: "/workspace",
            },
          ];

  const filteredItems = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();

    if (!keyword) {
      return viewer.recentItems;
    }

    return searchableItems
      .filter((item) =>
        `${item.title} ${item.caption ?? ""} ${item.href}`.toLowerCase().includes(keyword),
      )
      .slice(0, 6);
  }, [deferredQuery, searchableItems, viewer.recentItems]);

  const notificationCount = viewer.notifications.length;
  const hasQuery = deferredQuery.trim().length > 0;
  const searchItems = hasQuery ? filteredItems : viewer.recentItems.slice(0, 4);
  const showSearchPanel = searchOpen && (searchFocused || hasQuery || searchItems.length > 0);
  const activeSearchId =
    activeSearchIndex >= 0 && activeSearchIndex < searchItems.length
      ? `${searchPanelId}-item-${activeSearchIndex}`
      : undefined;

  function closeSearchPanel(resetQuery = false) {
    if (resetQuery) {
      setQuery("");
    }
    setSearchFocused(false);
    setSearchOpen(false);
    setActiveSearchIndex(-1);
  }

  useEffect(() => {
    closeSearchPanel(true);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showSearchPanel) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && searchRootRef.current?.contains(target)) {
        return;
      }

      closeSearchPanel(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showSearchPanel]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && notificationsRootRef.current?.contains(target)) {
        return;
      }

      setNotificationsOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!showSearchPanel) {
      return;
    }

    if (searchItems.length === 0) {
      setActiveSearchIndex(-1);
      return;
    }

    setActiveSearchIndex((current) => {
      if (current < 0) {
        return hasQuery ? 0 : -1;
      }

      return Math.min(current, searchItems.length - 1);
    });
  }, [hasQuery, searchItems, showSearchPanel]);

  function handleSearchInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSearchPanel(false);
      return;
    }

    if (searchItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showSearchPanel) {
        setSearchOpen(true);
      }
      setActiveSearchIndex((current) => Math.min(current + 1, searchItems.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!showSearchPanel) {
        setSearchOpen(true);
      }
      setActiveSearchIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && activeSearchIndex >= 0 && activeSearchIndex < searchItems.length) {
      event.preventDefault();
      const selectedItem = searchItems[activeSearchIndex];
      closeSearchPanel(true);
      router.push(selectedItem.href);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[rgba(247,248,249,0.9)] backdrop-blur-xl">
      <div className="px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div
              ref={searchRootRef}
              className="relative min-w-0"
              onFocus={() => {
                setSearchFocused(true);
                setSearchOpen(true);
              }}
              onBlur={(event) => {
                const nextTarget = event.relatedTarget;

                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                  return;
                }

                closeSearchPanel(false);
              }}
            >
              <div className="rounded-[26px] bg-[color:var(--surface)] px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    aria-live="polite"
                    className="rounded-full bg-[color:var(--selected)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--primary)]"
                  >
                    {hasQuery ? `${formatIntegerDisplay(filteredItems.length)}건` : "최근 이동"}
                  </div>
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={handleSearchInputKeyDown}
                    placeholder="메뉴, 프로젝트, 전표, NCR, 문서를 검색하세요"
                    className="min-w-[180px] flex-1 border-none bg-transparent text-sm font-medium text-[color:var(--text)] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-[color:var(--text-muted)]"
                    style={{ outline: "none", boxShadow: "none" }}
                    aria-label="전체 메뉴와 문서 검색"
                    aria-expanded={showSearchPanel}
                    aria-controls={searchPanelId}
                    aria-activedescendant={activeSearchId}
                    role="combobox"
                    aria-autocomplete="list"
                  />
                  <div className="hidden rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)] sm:inline-flex">
                    전체 메뉴
                  </div>
                </div>
              </div>

              {showSearchPanel ? (
                <div
                  id={searchPanelId}
                  className="absolute left-0 right-0 z-10 mt-3 rounded-[28px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.98)] p-4 shadow-[var(--shadow-panel)]"
                  role="listbox"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
                      {hasQuery ? "검색 결과" : "최근 이동"}
                    </div>
                    <div className="text-xs font-medium text-[color:var(--text-muted)]">
                      {hasQuery
                        ? `${formatIntegerDisplay(filteredItems.length)}건`
                        : `${formatIntegerDisplay(searchItems.length)}개`}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                      {searchItems.length > 0 ? (
                        searchItems.map((item) => (
                          <Link
                            key={item.href}
                            id={`${searchPanelId}-item-${searchItems.indexOf(item)}`}
                            href={item.href}
                            prefetch={false}
                            onClick={() => closeSearchPanel(true)}
                            onMouseEnter={() => setActiveSearchIndex(searchItems.indexOf(item))}
                            role="option"
                            aria-selected={activeSearchIndex === searchItems.indexOf(item)}
                            className={`rounded-2xl border px-4 py-3 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)] hover:bg-white ${
                              activeSearchIndex === searchItems.indexOf(item)
                                ? "border-[color:var(--primary)] bg-white shadow-[0_12px_24px_rgba(12,102,228,0.08)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
                            }`}
                          >
                            <div className="font-medium text-[color:var(--text)]">
                              {item.title}
                          </div>
                          {item.caption ? (
                            <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {item.caption}
                            </div>
                          ) : null}
                        </Link>
                      ))
                    ) : (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm text-[color:var(--text-muted)]"
                      >
                        검색 결과가 없습니다. 메뉴명이나 문서명을 더 짧게 입력해 보세요.
                      </div>
                    )}
                  </div>

                  {!hasQuery && viewer.favoriteItems.length > 0 ? (
                    <div className="mt-4 border-t border-[color:var(--border)] pt-4">
                      <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
                        즐겨찾기
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {viewer.favoriteItems.slice(0, 4).map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            onClick={() => closeSearchPanel(true)}
                            className="rounded-full bg-[color:var(--selected)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary)]"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end xl:pl-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] xl:hidden"
              aria-haspopup="dialog"
            >
              메뉴
            </button>
            <button
              type="button"
              onClick={() => setQuickCreateOpen(true)}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              바로가기
            </button>

            <div ref={notificationsRootRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2 text-sm font-medium text-[color:var(--text)]"
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
              >
                <span className="flex items-center gap-2">
                  <span>알림</span>
                  <span className="rounded-full bg-[color:var(--selected)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--primary)]">
                    {formatIntegerDisplay(notificationCount)}
                  </span>
                </span>
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 z-10 mt-3 w-[min(340px,calc(100vw-2rem))] rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-panel)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-[color:var(--text)]">
                      공통 알림
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        pushToast({
                          title: "알림 정리 완료",
                          description: "현재 mock 알림을 모두 확인 처리했습니다.",
                          tone: "success",
                        });
                        setNotificationsOpen(false);
                      }}
                      className="text-xs font-semibold text-[color:var(--primary)]"
                    >
                      모두 확인
                    </button>
                  </div>
                  <div className="space-y-3">
                    {viewer.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[color:var(--text)]">
                            {notification.title}
                          </div>
                          <StatusBadge label={notification.tone} tone={notification.tone} />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                          {notification.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setPreferencesOpen(true)}
              className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-left shadow-[var(--shadow-soft)]"
            >
              <div className="text-sm font-semibold text-[color:var(--text)]">
                {viewer.displayName}
              </div>
            </button>

            <Link
              href="/auth/logout"
              prefetch={false}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text)]"
            >
              로그아웃
            </Link>
          </div>
        </div>
      </div>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        eyebrow="작업 메뉴"
        title="모바일 메뉴"
        description="모바일과 태블릿에서는 여기서 주요 업무 화면으로 이동합니다."
      >
        <div className="grid gap-6">
          {viewer.navigationGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
            >
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
                {group.title}
              </div>
              <div className="mt-4 grid gap-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
                  >
                    <div className="text-sm font-semibold text-[color:var(--text)]">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                      {item.caption}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
              즐겨찾기
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {viewer.favoriteItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full bg-[color:var(--selected)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary)]"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        eyebrow="바로가기"
        title="자주 쓰는 화면 바로가기"
        description="역할에 맞는 주요 화면으로 바로 이동합니다."
      >
        <div className="grid gap-4">
          {quickCreateItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              prefetch={false}
              onClick={() => {
                setQuickCreateOpen(false);
                pushToast({
                  title: `${item.title} 진입`,
                  description: item.description,
                  tone: "info",
                });
              }}
              className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-5 transition hover:-translate-y-0.5 hover:border-[color:var(--primary)]"
            >
              <div className="text-base font-semibold text-[color:var(--text)]">
                {item.title}
              </div>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                {item.description}
              </p>
            </Link>
          ))}

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-5">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
              사용 팁
            </div>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
              검색은 화면 탐색, 바로가기는 자주 쓰는 화면으로 빠르게 이동할 때 가장 효율적입니다.
            </p>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        eyebrow="내 작업 환경"
        title="개인화와 저장 보기"
        description="즐겨찾기, 최근 메뉴, 저장 보기, 알림 선호를 한 곳에서 정리합니다."
        footer={
          <button
            type="button"
            onClick={() => {
              setPreferencesOpen(false);
              pushToast({
                title: "개인화 저장",
                description: "saved view와 알림 선호 mock 설정을 반영했습니다.",
                tone: "success",
              });
            }}
            className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            저장
          </button>
        }
      >
        <div className="grid gap-6">
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
              사용자 정보
            </div>
            <div className="mt-4">
              <div className="text-lg font-semibold text-[color:var(--text)]">
                {viewer.displayName}
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                {viewer.orgUnitName} · {viewer.role}
              </div>
              <div className="mt-2 text-sm text-[color:var(--text-muted)]">
                {viewer.email}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
              저장 보기
            </div>
            <div className="mt-4 grid gap-3">
              {viewer.savedViews.map((view) => (
                <Link
                  key={view.id}
                  href={view.href}
                  prefetch={false}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
                >
                  <div className="text-sm font-semibold text-[color:var(--text)]">
                    {view.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                    {view.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
                즐겨찾기 메뉴
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {viewer.favoriteItems.map((item) => (
                  <span
                    key={item.href}
                    className="rounded-full bg-[color:var(--selected)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary)]"
                  >
                    {item.title}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
                최근 메뉴
              </div>
              <div className="mt-4 grid gap-2">
                {viewer.recentItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="text-sm font-medium text-[color:var(--text)]"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[color:var(--text-muted)]">
              알림 선호
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[color:var(--text-muted)]">
              <div>승인 대기: 즉시</div>
              <div>문서 게시: 일간 요약</div>
              <div>권한 변경: 관리자만</div>
            </div>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
