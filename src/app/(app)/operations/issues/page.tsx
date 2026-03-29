"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import type { OpsIssue, IssueCategory, IssueUrgency, IssueStatus } from "@/types/operations";

const categoryTone: Record<IssueCategory, "danger" | "warning" | "info" | "default"> = {
  "안전사고": "danger",
  "시설고장": "warning",
  "이용자컴플레인": "info",
  "직원이슈": "warning",
  "기타": "default",
};

const urgencyTone: Record<IssueUrgency, "danger" | "warning" | "success"> = {
  "긴급": "danger",
  "보통": "warning",
  "낮음": "success",
};

const statusTone: Record<IssueStatus, "default" | "info" | "warning" | "success" | "danger"> = {
  "접수": "default",
  "분석중": "info",
  "배정됨": "warning",
  "처리중": "info",
  "완료": "success",
  "종결": "default",
};

function RiskMeter({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" title={`위험도 ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            i <= level
              ? level >= 4
                ? "bg-[color:var(--danger)]"
                : level >= 3
                  ? "bg-[color:var(--warning)]"
                  : "bg-[color:var(--success)]"
              : "bg-[color:var(--border)]",
          )}
        />
      ))}
      <span className="ml-1 text-[10px] font-semibold text-[color:var(--text-muted)]">
        {level}/5
      </span>
    </div>
  );
}

export default function IssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterUrgency) params.set("urgency", filterUrgency);
    if (filterStatus) params.set("status", filterStatus);

    setLoading(true);
    fetch(`/api/operations/issues?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setIssues(j.data.items);
      })
      .finally(() => setLoading(false));
  }, [filterCategory, filterUrgency, filterStatus]);

  const stats = {
    total: issues.length,
    urgent: issues.filter((i) => i.aiAnalysis?.urgency === "긴급").length,
    pending: issues.filter((i) => !["완료", "종결"].includes(i.status)).length,
    resolved: issues.filter((i) => ["완료", "종결"].includes(i.status)).length,
  };

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title="이슈관리"
        description="시설 운영 이슈를 등록하고 AI 분석 결과를 확인합니다."
        actions={
          <Link
            href="/operations/issues/new"
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--primary-hover)]"
          >
            이슈 등록
          </Link>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "전체 이슈", value: stats.total, tone: "info" as const },
          { label: "긴급 이슈", value: stats.urgent, tone: "danger" as const },
          { label: "미해결", value: stats.pending, tone: "warning" as const },
          { label: "해결 완료", value: stats.resolved, tone: "success" as const },
        ].map((card) => (
          <Panel key={card.label} className="p-4 text-center">
            <div className="text-sm text-[color:var(--text-muted)]">{card.label}</div>
            <div
              className={cn(
                "mt-1 text-2xl font-bold",
                card.tone === "danger" && "text-[color:var(--danger)]",
                card.tone === "warning" && "text-[color:var(--warning)]",
                card.tone === "success" && "text-[color:var(--success)]",
                card.tone === "info" && "text-[color:var(--primary)]",
              )}
            >
              {card.value}
            </div>
          </Panel>
        ))}
      </div>

      {/* Filters */}
      <Panel className="flex flex-wrap items-center gap-3 p-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">전체 카테고리</option>
          <option value="안전사고">안전사고</option>
          <option value="시설고장">시설고장</option>
          <option value="이용자컴플레인">이용자컴플레인</option>
          <option value="직원이슈">직원이슈</option>
          <option value="기타">기타</option>
        </select>
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">전체 긴급도</option>
          <option value="긴급">긴급</option>
          <option value="보통">보통</option>
          <option value="낮음">낮음</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="접수">접수</option>
          <option value="분석중">분석중</option>
          <option value="배정됨">배정됨</option>
          <option value="처리중">처리중</option>
          <option value="완료">완료</option>
          <option value="종결">종결</option>
        </select>
      </Panel>

      {/* Issue List */}
      <div className="space-y-3">
        {loading ? (
          <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
            불러오는 중...
          </Panel>
        ) : issues.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
            등록된 이슈가 없습니다.
          </Panel>
        ) : (
          issues.map((issue) => (
            <Panel
              key={issue._id}
              className="cursor-pointer p-4 transition hover:border-[color:var(--primary)]"
            >
              <div
                className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/operations/issues/${issue._id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/operations/issues/${issue._id}`);
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[color:var(--text)]">
                      {issue.title}
                    </h3>
                    <StatusBadge label={issue.status} tone={statusTone[issue.status as IssueStatus] ?? "default"} />
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)] line-clamp-2">
                    {issue.description}
                  </p>
                  {issue.aiAnalysis && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={issue.aiAnalysis.category}
                        tone={categoryTone[issue.aiAnalysis.category as IssueCategory] ?? "default"}
                      />
                      <StatusBadge
                        label={issue.aiAnalysis.urgency}
                        tone={urgencyTone[issue.aiAnalysis.urgency as IssueUrgency] ?? "warning"}
                      />
                      <RiskMeter level={issue.aiAnalysis.riskLevel} />
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
                    <span>보고자: {issue.reporterName}</span>
                    {issue.location && <span>위치: {issue.location}</span>}
                    {issue.assignedStaffName && (
                      <span>담당: {issue.assignedStaffName}</span>
                    )}
                    <span>
                      {new Date(issue.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                {issue.aiAnalysis && (
                  <div className="shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs lg:max-w-xs">
                    <div className="mb-1 font-semibold text-[color:var(--text)]">AI 권고</div>
                    <p className="text-[color:var(--text-muted)] leading-5">
                      {issue.aiAnalysis.recommendedAction}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          ))
        )}
      </div>
    </>
  );
}
