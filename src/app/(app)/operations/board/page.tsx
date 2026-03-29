"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import type { BoardEntry, BoardEntryType, IssueCategory, IssueUrgency } from "@/types/operations";

const typeConfig: Record<
  BoardEntryType,
  { label: string; tone: "danger" | "warning" | "info" | "default" | "success"; icon: string }
> = {
  issue: { label: "이슈", tone: "danger", icon: "!" },
  notification: { label: "알림", tone: "info", icon: "i" },
  handover: { label: "인수인계", tone: "warning", icon: "H" },
  announcement: { label: "공지", tone: "success", icon: "A" },
};

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

function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default function BoardPage() {
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");

  // Announcement form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = useCallback(() => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    if (filterUrgency) params.set("urgency", filterUrgency);

    setLoading(true);
    fetch(`/api/operations/board?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEntries(j.data.items);
      })
      .finally(() => setLoading(false));
  }, [filterType, filterCategory, filterUrgency]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function handlePostAnnouncement() {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/operations/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "announcement",
          title: formTitle.trim(),
          content: formContent.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setFormTitle("");
        setFormContent("");
        loadEntries();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Group entries by date
  const groupedEntries: Record<string, BoardEntry[]> = {};
  for (const entry of entries) {
    const dateKey = entry.createdAt.slice(0, 10);
    if (!groupedEntries[dateKey]) groupedEntries[dateKey] = [];
    groupedEntries[dateKey].push(entry);
  }

  const sortedDateKeys = Object.keys(groupedEntries).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title="운영보드"
        description="이슈, 알림, 인수인계, 공지를 실시간 피드로 확인합니다."
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--primary-hover)]"
          >
            {showForm ? "닫기" : "공지 작성"}
          </button>
        }
      />

      {/* Announcement Form */}
      {showForm && (
        <Panel className="p-6">
          <h3 className="mb-3 font-semibold">공지사항 작성</h3>
          <div className="space-y-3">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="공지 제목"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
            />
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="공지 내용"
              rows={3}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
            />
            <button
              onClick={handlePostAnnouncement}
              disabled={submitting}
              className="rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              {submitting ? "등록 중..." : "공지 등록"}
            </button>
          </div>
        </Panel>
      )}

      {/* Filters */}
      <Panel className="flex flex-wrap items-center gap-3 p-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">전체 유형</option>
          <option value="issue">이슈</option>
          <option value="notification">알림</option>
          <option value="handover">인수인계</option>
          <option value="announcement">공지</option>
        </select>
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
        <button
          onClick={loadEntries}
          className="ml-auto rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
        >
          새로고침
        </button>
      </Panel>

      {/* Feed */}
      {loading ? (
        <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
          불러오는 중...
        </Panel>
      ) : entries.length === 0 ? (
        <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
          운영보드에 등록된 항목이 없습니다.
        </Panel>
      ) : (
        <div className="space-y-6">
          {sortedDateKeys.map((dateKey) => (
            <div key={dateKey}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-[color:var(--border)]" />
                <span className="text-xs font-semibold text-[color:var(--text-muted)]">
                  {new Date(dateKey).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </span>
                <div className="h-px flex-1 bg-[color:var(--border)]" />
              </div>

              <div className="space-y-3">
                {groupedEntries[dateKey].map((entry) => {
                  const config = typeConfig[entry.type as BoardEntryType] ?? typeConfig.announcement;

                  return (
                    <Panel key={entry._id} className="p-4">
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
                            config.tone === "danger" && "bg-[color:var(--danger)]",
                            config.tone === "warning" && "bg-[color:var(--warning)]",
                            config.tone === "info" && "bg-[color:var(--primary)]",
                            config.tone === "success" && "bg-[color:var(--success)]",
                            config.tone === "default" && "bg-[color:var(--text-muted)]",
                          )}
                        >
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge label={config.label} tone={config.tone} />
                            <h4 className="font-semibold text-[color:var(--text)]">
                              {entry.title}
                            </h4>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                            {entry.content}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {entry.category && (
                              <StatusBadge
                                label={entry.category}
                                tone={categoryTone[entry.category as IssueCategory] ?? "default"}
                              />
                            )}
                            {entry.urgency && (
                              <StatusBadge
                                label={entry.urgency}
                                tone={urgencyTone[entry.urgency as IssueUrgency] ?? "warning"}
                              />
                            )}
                            {entry.riskLevel && (
                              <span className="text-[10px] font-semibold text-[color:var(--text-muted)]">
                                위험도 {entry.riskLevel}/5
                              </span>
                            )}
                            <span className="text-[10px] text-[color:var(--text-muted)]">
                              {entry.authorName} - {formatRelativeTime(entry.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
