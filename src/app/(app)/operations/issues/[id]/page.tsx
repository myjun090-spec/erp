"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailField } from "@/components/ui/detail-field";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/cn";
import type {
  OpsIssue,
  IssueCategory,
  IssueUrgency,
  IssueStatus,
  StaffAssignmentSuggestion,
} from "@/types/operations";

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

function RiskBar({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "h-3 w-6 rounded-sm",
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
      <span className="ml-2 text-sm font-bold">{level}/5</span>
    </div>
  );
}

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<OpsIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Assignment
  const [suggestions, setSuggestions] = useState<StaffAssignmentSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [assigning, setAssigning] = useState("");

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    loadIssue();
  }, [id]);

  function loadIssue() {
    setLoading(true);
    fetch(`/api/operations/issues/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setIssue(j.data);
      })
      .finally(() => setLoading(false));
  }

  async function handleReanalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/operations/issues/${id}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok && issue) {
        setIssue({ ...issue, aiAnalysis: data.data.aiAnalysis, status: "분석중" });
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGetSuggestions() {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/operations/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: id }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.data.suggestions);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleAssign(suggestion: StaffAssignmentSuggestion) {
    setAssigning(suggestion.staffId);
    try {
      const res = await fetch(`/api/operations/issues/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: suggestion.staffId,
          staffName: suggestion.staffName,
          reason: suggestion.reason,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        loadIssue();
        setSuggestions([]);
      }
    } finally {
      setAssigning("");
    }
  }

  async function handleStatusUpdate(newStatus: string) {
    setUpdatingStatus(true);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (resolution.trim()) body.resolution = resolution.trim();

      const res = await fetch(`/api/operations/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        loadIssue();
        setResolution("");
      }
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="로딩 중"
        description="이슈 정보를 불러오고 있습니다."
      />
    );
  }

  if (!issue) {
    return (
      <StatePanel
        variant="error"
        title="조회 실패"
        description="이슈를 찾을 수 없습니다."
        action={
          <button
            onClick={() => router.push("/operations/issues")}
            className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            목록으로
          </button>
        }
      />
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title={issue.title}
        description={`보고자: ${issue.reporterName} | ${formatDate(issue.createdAt)}`}
        actions={
          <button
            onClick={() => router.push("/operations/issues")}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-2.5 text-sm font-semibold"
          >
            목록으로
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Issue Details */}
          <Panel className="p-6">
            <h3 className="mb-4 text-base font-semibold text-[color:var(--text)]">
              이슈 정보
            </h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="상태" value={
                <StatusBadge
                  label={issue.status}
                  tone={statusTone[issue.status as IssueStatus] ?? "default"}
                />
              } />
              <DetailField label="위치" value={issue.location || "-"} />
              <div className="md:col-span-2">
                <DetailField label="상세 내용" value={
                  <p className="whitespace-pre-wrap leading-7 text-sm">
                    {issue.description}
                  </p>
                } />
              </div>
              {issue.assignedStaffName && (
                <DetailField label="담당자" value={issue.assignedStaffName} />
              )}
              {issue.assignmentReason && (
                <DetailField label="배정 사유" value={issue.assignmentReason} />
              )}
              {issue.resolution && (
                <div className="md:col-span-2">
                  <DetailField label="해결 내역" value={issue.resolution} />
                </div>
              )}
              {issue.resolvedAt && (
                <DetailField label="해결 일시" value={formatDate(issue.resolvedAt)} />
              )}
            </dl>

            {/* Images */}
            {issue.imageUrls.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  첨부 이미지
                </div>
                <div className="flex flex-wrap gap-3">
                  {issue.imageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`첨부 이미지 ${i + 1}`}
                      className="h-32 w-32 rounded-xl border border-[color:var(--border)] object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Status Actions */}
          {!["완료", "종결"].includes(issue.status) && (
            <Panel className="p-6">
              <h3 className="mb-4 text-base font-semibold text-[color:var(--text)]">
                상태 변경
              </h3>
              <div className="space-y-4">
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="처리 내역을 입력하세요 (선택사항)"
                  rows={3}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  {issue.status === "접수" && (
                    <button
                      onClick={() => handleStatusUpdate("처리중")}
                      disabled={updatingStatus}
                      className="rounded-lg bg-[color:var(--info)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      처리 시작
                    </button>
                  )}
                  {["접수", "분석중", "배정됨", "처리중"].includes(issue.status) && (
                    <button
                      onClick={() => handleStatusUpdate("완료")}
                      disabled={updatingStatus}
                      className="rounded-lg bg-[color:var(--success)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      완료 처리
                    </button>
                  )}
                  {issue.status !== "보류" && (
                    <button
                      onClick={() => handleStatusUpdate("보류" as string)}
                      disabled={updatingStatus}
                      className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]"
                    >
                      보류
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* Staff Assignment */}
          {!["완료", "종결"].includes(issue.status) && (
            <Panel className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[color:var(--text)]">
                  직원 배정
                </h3>
                <button
                  onClick={handleGetSuggestions}
                  disabled={loadingSuggestions}
                  className={cn(
                    "rounded-lg px-4 py-2 text-xs font-semibold text-white transition",
                    loadingSuggestions
                      ? "cursor-not-allowed bg-[color:var(--text-muted)]"
                      : "bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]",
                  )}
                >
                  {loadingSuggestions ? "분석 중..." : "AI 추천 요청"}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-3">
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.staffId || idx}
                      className="flex items-start justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-[color:var(--primary)]">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold">{s.staffName}</span>
                          {s.isOnShift && (
                            <StatusBadge label="근무중" tone="success" />
                          )}
                          <span className="text-xs font-bold text-[color:var(--primary)]">
                            {s.matchScore}점
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                          {s.reason}
                        </p>
                        {s.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {s.skills.map((sk) => (
                              <span
                                key={sk}
                                className="rounded-md bg-white px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssign(s)}
                        disabled={!!assigning}
                        className={cn(
                          "shrink-0 rounded-lg px-4 py-2 text-xs font-semibold text-white transition",
                          assigning === s.staffId
                            ? "bg-[color:var(--text-muted)]"
                            : "bg-[color:var(--success)] hover:opacity-90",
                        )}
                      >
                        {assigning === s.staffId ? "배정 중..." : "배정"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* Sidebar: AI Analysis */}
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                AI 분석 결과
              </h3>
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="rounded-lg border border-[color:var(--border)] px-3 py-1 text-[10px] font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
              >
                {analyzing ? "분석 중..." : "재분석"}
              </button>
            </div>

            {issue.aiAnalysis ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-xs text-[color:var(--text-muted)]">카테고리</div>
                  <StatusBadge
                    label={issue.aiAnalysis.category}
                    tone={categoryTone[issue.aiAnalysis.category as IssueCategory] ?? "default"}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[color:var(--text-muted)]">긴급도</div>
                  <StatusBadge
                    label={issue.aiAnalysis.urgency}
                    tone={urgencyTone[issue.aiAnalysis.urgency as IssueUrgency] ?? "warning"}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[color:var(--text-muted)]">위험도</div>
                  <RiskBar level={issue.aiAnalysis.riskLevel} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[color:var(--text-muted)]">분석 요약</div>
                  <p className="text-sm leading-6 text-[color:var(--text)]">
                    {issue.aiAnalysis.summary}
                  </p>
                </div>
                <div>
                  <div className="mb-1 text-xs text-[color:var(--text-muted)]">권고 조치</div>
                  <p className="text-sm leading-6 text-[color:var(--text)]">
                    {issue.aiAnalysis.recommendedAction}
                  </p>
                </div>
                <div className="text-[10px] text-[color:var(--text-muted)]">
                  분석 시각: {formatDate(issue.aiAnalysis.analyzedAt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[color:var(--text-muted)]">
                AI 분석이 아직 수행되지 않았습니다.
              </div>
            )}
          </Panel>

          {/* Timeline */}
          <Panel className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              타임라인
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[color:var(--primary)]" />
                <div>
                  <div className="text-xs font-medium">이슈 등록</div>
                  <div className="text-[10px] text-[color:var(--text-muted)]">
                    {formatDate(issue.createdAt)} - {issue.reporterName}
                  </div>
                </div>
              </div>
              {issue.aiAnalysis && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[color:var(--info)]" />
                  <div>
                    <div className="text-xs font-medium">AI 분석 완료</div>
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                      {formatDate(issue.aiAnalysis.analyzedAt)}
                    </div>
                  </div>
                </div>
              )}
              {issue.assignedStaffName && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[color:var(--warning)]" />
                  <div>
                    <div className="text-xs font-medium">
                      {issue.assignedStaffName}에게 배정
                    </div>
                  </div>
                </div>
              )}
              {issue.resolvedAt && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[color:var(--success)]" />
                  <div>
                    <div className="text-xs font-medium">해결 완료</div>
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                      {formatDate(issue.resolvedAt)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
