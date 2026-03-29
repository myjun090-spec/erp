"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type {
  WeeklyReportData,
  IssueCategory,
  IssueUrgency,
} from "@/types/operations";

const categoryColors: Record<IssueCategory, string> = {
  "안전사고": "var(--danger)",
  "시설고장": "var(--warning)",
  "이용자컴플레인": "var(--primary)",
  "직원이슈": "var(--info, var(--primary))",
  "기타": "var(--text-muted)",
};

const urgencyColors: Record<IssueUrgency, string> = {
  "긴급": "var(--danger)",
  "보통": "var(--warning)",
  "낮음": "var(--success)",
};

function BarChart({
  data,
  colorMap,
  maxValue,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  maxValue?: number;
}) {
  const entries = Object.entries(data);
  const max = maxValue ?? Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-right text-xs font-medium text-[color:var(--text-muted)]">
            {label}
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="h-6 flex-1 rounded-lg bg-[color:var(--surface-muted)]">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: `${max > 0 ? (value / max) * 100 : 0}%`,
                  backgroundColor: colorMap[label] ?? "var(--primary)",
                  minWidth: value > 0 ? "8px" : "0px",
                }}
              />
            </div>
            <span className="w-8 text-right text-xs font-bold text-[color:var(--text)]">
              {value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskTrendChart({
  data,
}: {
  data: Array<{ date: string; avgRisk: number; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[color:var(--text-muted)]">
        데이터가 없습니다.
      </div>
    );
  }

  const maxRisk = 5;
  const chartHeight = 120;
  const barWidth = Math.min(40, Math.floor(300 / data.length));

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1" style={{ minHeight: chartHeight + 30 }}>
        {data.map((d) => {
          const height = (d.avgRisk / maxRisk) * chartHeight;
          const color =
            d.avgRisk >= 4
              ? "var(--danger)"
              : d.avgRisk >= 3
                ? "var(--warning)"
                : "var(--success)";

          return (
            <div key={d.date} className="flex flex-col items-center">
              <span className="mb-1 text-[9px] font-bold" style={{ color }}>
                {d.avgRisk}
              </span>
              <div
                className="rounded-t-md transition-all duration-500"
                style={{
                  width: barWidth,
                  height: Math.max(height, 4),
                  backgroundColor: color,
                }}
              />
              <span className="mt-1 text-[9px] text-[color:var(--text-muted)]">
                {d.date.slice(5)}
              </span>
              <span className="text-[8px] text-[color:var(--text-muted)]">
                {d.count}건
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportPage() {
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);

  const loadReport = useCallback(() => {
    setLoading(true);
    fetch(`/api/operations/report?start=${startDate}&end=${endDate}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setReport(j.data);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const resolutionRate =
    report && report.totalIssues > 0
      ? Math.round((report.resolvedIssues / report.totalIssues) * 100)
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title="주간 리포트"
        description="AI가 주간 운영 통계를 분석하고 인사이트를 제공합니다."
      />

      {/* Period Selector */}
      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
            시작일
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
            종료일
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={loadReport}
          disabled={loading}
          className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
        >
          {loading ? "조회 중..." : "조회"}
        </button>
      </Panel>

      {loading ? (
        <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
          보고서를 생성하고 있습니다...
        </Panel>
      ) : !report ? (
        <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
          보고서 데이터를 불러올 수 없습니다.
        </Panel>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Panel className="p-5 text-center">
              <div className="text-sm text-[color:var(--text-muted)]">총 이슈</div>
              <div className="mt-1 text-3xl font-bold text-[color:var(--primary)]">
                {report.totalIssues}
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">건</div>
            </Panel>
            <Panel className="p-5 text-center">
              <div className="text-sm text-[color:var(--text-muted)]">해결 완료</div>
              <div className="mt-1 text-3xl font-bold text-[color:var(--success)]">
                {report.resolvedIssues}
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                건 ({resolutionRate}%)
              </div>
            </Panel>
            <Panel className="p-5 text-center">
              <div className="text-sm text-[color:var(--text-muted)]">평균 처리시간</div>
              <div
                className={cn(
                  "mt-1 text-3xl font-bold",
                  report.avgResolutionTimeHours > 24
                    ? "text-[color:var(--danger)]"
                    : report.avgResolutionTimeHours > 12
                      ? "text-[color:var(--warning)]"
                      : "text-[color:var(--success)]",
                )}
              >
                {report.avgResolutionTimeHours}
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">시간</div>
            </Panel>
            <Panel className="p-5 text-center">
              <div className="text-sm text-[color:var(--text-muted)]">해결률</div>
              <div
                className={cn(
                  "mt-1 text-3xl font-bold",
                  resolutionRate >= 80
                    ? "text-[color:var(--success)]"
                    : resolutionRate >= 50
                      ? "text-[color:var(--warning)]"
                      : "text-[color:var(--danger)]",
                )}
              >
                {resolutionRate}
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">%</div>
            </Panel>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                카테고리별 분포
              </h3>
              <BarChart
                data={report.categoryDistribution}
                colorMap={categoryColors}
              />
            </Panel>

            <Panel className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                긴급도별 분포
              </h3>
              <BarChart
                data={report.urgencyDistribution}
                colorMap={urgencyColors}
              />
            </Panel>
          </div>

          {/* Risk Trend */}
          <Panel className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              일별 위험도 추이
            </h3>
            <RiskTrendChart data={report.riskTrend} />
          </Panel>

          {/* Staff Performance */}
          {report.staffPerformance.length > 0 && (
            <Panel className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                담당자별 실적
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)]">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[color:var(--text-muted)]">
                        담당자
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                        배정
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                        해결
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                        평균 처리(시간)
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-[color:var(--text-muted)]">
                        해결률
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.staffPerformance.map((staff) => {
                      const rate =
                        staff.assignedCount > 0
                          ? Math.round(
                              (staff.resolvedCount / staff.assignedCount) * 100,
                            )
                          : 0;
                      return (
                        <tr
                          key={staff.staffName}
                          className="border-b border-[color:var(--border)] last:border-b-0"
                        >
                          <td className="px-4 py-3 font-medium">{staff.staffName}</td>
                          <td className="px-4 py-3 text-right">{staff.assignedCount}</td>
                          <td className="px-4 py-3 text-right">{staff.resolvedCount}</td>
                          <td className="px-4 py-3 text-right">
                            {staff.avgResolutionHours > 0
                              ? Math.round(staff.avgResolutionHours * 10) / 10
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={cn(
                                "font-semibold",
                                rate >= 80
                                  ? "text-[color:var(--success)]"
                                  : rate >= 50
                                    ? "text-[color:var(--warning)]"
                                    : "text-[color:var(--danger)]",
                              )}
                            >
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* AI Insights */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                AI 인사이트
              </h3>
              {report.aiInsights ? (
                <div className="rounded-xl border border-[rgba(12,102,228,0.18)] bg-[rgba(233,242,255,0.5)] p-4">
                  <p className="text-sm leading-7 text-[color:var(--text)]">
                    {report.aiInsights}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-[color:var(--text-muted)]">
                  AI 인사이트가 없습니다.
                </div>
              )}
            </Panel>

            <Panel className="p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                AI 개선 권고
              </h3>
              {report.aiRecommendations.length > 0 ? (
                <div className="space-y-3">
                  {report.aiRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <p className="text-sm leading-6 text-[color:var(--text)]">
                        {rec}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[color:var(--text-muted)]">
                  권고 사항이 없습니다.
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
