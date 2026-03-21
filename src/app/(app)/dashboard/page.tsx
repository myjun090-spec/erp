"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useProjectSelection } from "@/components/layout/project-selection-context";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerDisplay } from "@/lib/number-input";
import { appendProjectIdToPath } from "@/lib/project-scope";

type DashboardPortfolioRecord = {
  id: string;
  code: string;
  name: string;
  customerName: string;
  projectType: string;
  periodLabel: string;
  status: string;
};

type DashboardLibraryRecord = {
  id: string;
  title: string;
  owner: string;
  updatedAt: string;
  status: string;
  href: string;
};

type DashboardOverview = {
  ongoingProjectCount: number;
  openNcrCount: number;
  unsettledJournalCount: number;
  pendingApprovalCount: number;
  portfolio: DashboardPortfolioRecord[];
  libraries: DashboardLibraryRecord[];
};

type DashboardApiResponse =
  | {
      ok: true;
      source: "database" | "empty";
      data: DashboardOverview;
    }
  | {
      ok: false;
      message?: string;
    };

const portfolioColumns = [
  { key: "project", label: "프로젝트" },
  { key: "customer", label: "고객사" },
  { key: "projectType", label: "유형" },
  { key: "period", label: "기간" },
  { key: "status", label: "상태" },
];

function formatProjectStatus(status: string) {
  switch (status) {
    case "active":
      return "진행중";
    case "planning":
      return "계획";
    case "completed":
      return "완료";
    case "archived":
      return "보관";
    case "cancelled":
    case "canceled":
      return "중단";
    default:
      return status || "-";
  }
}

function projectStatusTone(status: string) {
  switch (status) {
    case "active":
      return "info" as const;
    case "planning":
      return "warning" as const;
    case "completed":
      return "success" as const;
    case "archived":
    case "cancelled":
    case "canceled":
      return "default" as const;
    default:
      return "default" as const;
  }
}

function workspaceStatusTone(status: string) {
  switch (status) {
    case "게시중":
      return "success" as const;
    case "검토중":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { currentProject, currentProjectId } = useProjectSelection();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");
  const [dashboardData, setDashboardData] = useState<DashboardOverview | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const deferredSearch = useDeferredValue(searchValue);
  const { pushToast } = useToast();

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setDashboardLoading(true);

      try {
        const response = await fetch(
          appendProjectIdToPath("/api/dashboard", currentProjectId),
          { signal: controller.signal },
        );
        const json = (await response.json()) as DashboardApiResponse;

        if (!response.ok || !json.ok) {
          throw new Error(json.ok ? "대시보드를 불러오지 못했습니다." : json.message);
        }

        startTransition(() => {
          setDashboardData(json.data);
          setDashboardError(null);
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setDashboardError(
            error instanceof Error
              ? error.message
              : "대시보드 데이터를 불러오지 못했습니다.",
          );
        });
      } finally {
        if (!controller.signal.aborted) {
          setDashboardLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [currentProjectId, reloadToken]);

  const portfolio = dashboardData?.portfolio ?? [];
  const libraries = dashboardData?.libraries ?? [];
  const projectStatusOptions = [...new Set(portfolio.map((item) => item.status).filter(Boolean))];
  const projectTypeOptions = [
    ...new Set(portfolio.map((item) => item.projectType).filter((value) => value && value !== "-")),
  ];

  useEffect(() => {
    if (statusFilter !== "all" && !projectStatusOptions.includes(statusFilter)) {
      setStatusFilter("all");
    }

    if (projectTypeFilter !== "all" && !projectTypeOptions.includes(projectTypeFilter)) {
      setProjectTypeFilter("all");
    }
  }, [projectStatusOptions, projectTypeOptions, projectTypeFilter, statusFilter]);

  const filteredPortfolio = portfolio.filter((project) => {
    const keyword = deferredSearch.trim().toLowerCase();

    if (statusFilter !== "all" && project.status !== statusFilter) {
      return false;
    }

    if (projectTypeFilter !== "all" && project.projectType !== projectTypeFilter) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [
      project.name,
      project.code,
      project.customerName,
      project.projectType,
      formatProjectStatus(project.status),
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  const filteredPortfolioRows = filteredPortfolio.map((project) => ({
    id: project.id,
    projectName: project.name,
    project: (
      <div>
        <div className="font-medium text-[color:var(--text)]">{project.name}</div>
        <div className="mt-1 text-xs text-[color:var(--text-muted)]">{project.code}</div>
      </div>
    ),
    customer: project.customerName,
    projectType: project.projectType,
    period: project.periodLabel,
    status: (
      <StatusBadge
        label={formatProjectStatus(project.status)}
        tone={projectStatusTone(project.status)}
      />
    ),
  }));

  const libraryRows = libraries.map((post) => ({
    id: post.id,
    href: post.href,
    libraryTitle: post.title,
    title: (
      <div>
        <div className="font-medium text-[color:var(--text)]">{post.title}</div>
        <div className="mt-1 text-xs text-[color:var(--text-muted)]">{post.href}</div>
      </div>
    ),
    owner: post.owner,
    updatedAt: post.updatedAt,
    status: <StatusBadge label={post.status} tone={workspaceStatusTone(post.status)} />,
  }));

  const kpis = [
    {
      label: "진행 프로젝트",
      value: dashboardData?.ongoingProjectCount ?? null,
      note: currentProject
        ? "현재 프로젝트 기준 운영 중 또는 계획 중 상태를 집계합니다."
        : "접근 가능한 프로젝트 기준 운영 중 또는 계획 중 상태를 집계합니다.",
      href: currentProjectId ? `/projects/${currentProjectId}` : "/projects",
    },
    {
      label: "오픈 NCR",
      value: dashboardData?.openNcrCount ?? null,
      note: "품질 NCR 중 종료되지 않은 건수를 집계합니다.",
      href: appendProjectIdToPath("/quality/ncr", currentProjectId),
    },
    {
      label: "미확정 전표",
      value: dashboardData?.unsettledJournalCount ?? null,
      note: "재무 전표 중 posted 전 상태의 건수를 집계합니다.",
      href: appendProjectIdToPath("/finance/journal-entries", currentProjectId),
    },
    {
      label: "승인 대기",
      value: dashboardData?.pendingApprovalCount ?? null,
      note: "협업 승인함에서 현재 대기 상태인 작업 수입니다.",
      href: "/workspace",
    },
  ];

  const dashboardTableErrorState =
    dashboardError && !dashboardData
      ? {
          title: "대시보드 데이터를 불러오지 못했습니다",
          description: dashboardError,
          action: (
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              다시 불러오기
            </button>
          ),
        }
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="SMR ERP 운영 현황판"
        description={
          currentProject
            ? `${currentProject.name} 기준으로 진행 프로젝트, 오픈 NCR, 미확정 전표를 집계합니다. 승인 대기는 협업 승인함의 현재 대기 건수입니다.`
            : "접근 가능한 전체 프로젝트 기준으로 진행 프로젝트, 오픈 NCR, 미확정 전표를 집계합니다. 승인 대기는 협업 승인함의 현재 대기 건수입니다."
        }
        actions={
          <>
            <button
              type="button"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              onClick={() =>
                pushToast({
                  title: "Saved view 예정",
                  description: "Phase 4에서 개인화된 dashboard view를 추가합니다.",
                  tone: "info",
                })
              }
            >
              저장 보기 예고
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() =>
                pushToast({
                  title: "현황 브리프 생성",
                  description: "dashboard summary 기준으로 브리프 초안을 준비했습니다.",
                  tone: "success",
                })
              }
            >
              브리프 생성
            </button>
          </>
        }
      />

      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="프로젝트명, 코드, 고객사, 유형 검색"
        filters={[
          {
            key: "status",
            label: "상태",
            value: statusFilter,
            options: [{ value: "all", label: "전체 상태" }].concat(
              projectStatusOptions.map((status) => ({
                value: status,
                label: formatProjectStatus(status),
              })),
            ),
          },
          {
            key: "projectType",
            label: "유형",
            value: projectTypeFilter,
            options: [{ value: "all", label: "전체 유형" }].concat(
              projectTypeOptions.map((projectType) => ({
                value: projectType,
                label: projectType,
              })),
            ),
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === "status") {
            setStatusFilter(value);
            return;
          }

          setProjectTypeFilter(value);
        }}
        summary={`${formatIntegerDisplay(filteredPortfolioRows.length)}개 프로젝트 표시`}
        actions={
          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              setStatusFilter("all");
              setProjectTypeFilter("all");
            }}
            className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
          >
            필터 초기화
          </button>
        }
      />

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Panel key={kpi.label} className="grid-surface overflow-hidden p-0">
            <Link
              href={kpi.href}
              className="group block h-full px-4 py-4 transition hover:bg-[rgba(12,102,228,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
                  {kpi.label}
                </div>
                <span className="text-[11px] font-semibold text-[color:var(--primary)] transition group-hover:translate-x-0.5">
                  열기
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[color:var(--text)]">
                {dashboardLoading && kpi.value === null
                  ? "..."
                  : kpi.value === null
                    ? "-"
                    : formatIntegerDisplay(kpi.value)}
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                {dashboardError && !dashboardData
                  ? "실제 집계를 불러오지 못했습니다. 다시 시도해 주세요."
                  : kpi.note}
              </p>
            </Link>
          </Panel>
        ))}
      </section>
      <DataTable
        title="자료실 참조"
        description="협업 자료실의 최신 가이드를 대시보드에서 바로 확인합니다."
        columns={[
          { key: "title", label: "자료명" },
          { key: "owner", label: "담당 조직" },
          { key: "updatedAt", label: "최근 갱신" },
          { key: "status", label: "상태" },
        ]}
        rows={libraryRows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => router.push(String(row.href))}
        getRowAriaLabel={(row) => `${String(row.libraryTitle)} 상세 열기`}
        loading={dashboardLoading && !dashboardData}
        errorState={dashboardTableErrorState}
      />
      <DataTable
        title="프로젝트 현황"
        description="현재 프로젝트 컨텍스트에 맞는 진행 프로젝트를 실제 데이터로 조회합니다."
        columns={portfolioColumns}
        rows={filteredPortfolioRows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => router.push(`/projects/${String(row.id)}`)}
        getRowAriaLabel={(row) => `${String(row.projectName)} 프로젝트 상세 열기`}
        loading={dashboardLoading && !dashboardData}
        errorState={dashboardTableErrorState}
        emptyState={{
          title: "조건과 일치하는 프로젝트가 없습니다",
          description: "상태, 유형 필터나 검색어를 조정하면 포트폴리오 행이 다시 표시됩니다.",
          action: (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setStatusFilter("all");
                setProjectTypeFilter("all");
              }}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              필터 초기화
            </button>
          ),
        }}
      />
    </>
  );
}
