"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import type { HandoverEntry, ShiftType } from "@/types/operations";

const shiftOptions: ShiftType[] = ["오전", "오후", "야간"];

export default function HandoverPage() {
  const [handovers, setHandovers] = useState<HandoverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [shiftDate, setShiftDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [shiftType, setShiftType] = useState<ShiftType>("오전");
  const [manualNotes, setManualNotes] = useState("");
  const [vocNotes, setVocNotes] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [reminderInput, setReminderInput] = useState("");
  const [reminders, setReminders] = useState<string[]>([]);

  // AI Briefing
  const [aiBriefing, setAiBriefing] = useState<{
    aiSummary: string;
    issuesSummary: Array<{
      issueId: string;
      title: string;
      status: string;
      summary: string;
    }>;
    pendingItems: string[];
  } | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedHandover, setSelectedHandover] = useState<HandoverEntry | null>(null);

  useEffect(() => {
    loadHandovers();
  }, []);

  function loadHandovers() {
    setLoading(true);
    fetch("/api/operations/handover?limit=30")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setHandovers(j.data.items);
      })
      .finally(() => setLoading(false));
  }

  async function handleGenerateBriefing() {
    setGeneratingBriefing(true);
    try {
      const res = await fetch("/api/operations/handover/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftDate, shiftType }),
      });
      const data = await res.json();
      if (data.ok) {
        setAiBriefing(data.data);
      }
    } finally {
      setGeneratingBriefing(false);
    }
  }

  function handleAddReminder() {
    if (reminderInput.trim()) {
      setReminders([...reminders, reminderInput.trim()]);
      setReminderInput("");
    }
  }

  function handleRemoveReminder(idx: number) {
    setReminders(reminders.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/operations/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate,
          shiftType,
          manualNotes: manualNotes.trim(),
          vocNotes: vocNotes.trim(),
          specialInstructions: specialInstructions.trim(),
          reminders,
          aiSummary: aiBriefing?.aiSummary ?? null,
          issuesSummary: aiBriefing?.issuesSummary ?? [],
          pendingItems: aiBriefing?.pendingItems ?? [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowForm(false);
        setManualNotes("");
        setVocNotes("");
        setSpecialInstructions("");
        setReminders([]);
        setAiBriefing(null);
        loadHandovers();
      }
    } finally {
      setSubmitting(false);
    }
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
        title="인수인계"
        description="AI가 근무 인수인계 브리핑을 생성하고, 수기 메모를 추가할 수 있습니다."
        actions={
          <button
            onClick={() => {
              setShowForm(!showForm);
              setSelectedHandover(null);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--primary-hover)]"
          >
            {showForm ? "닫기" : "인수인계 작성"}
          </button>
        }
      />

      {/* Detail View */}
      {selectedHandover && !showForm && (
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {selectedHandover.shiftDate} {selectedHandover.shiftType} 인수인계
            </h3>
            <button
              onClick={() => setSelectedHandover(null)}
              className="rounded-lg border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]"
            >
              닫기
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-xs text-[color:var(--text-muted)]">
              작성자: {selectedHandover.authorName} |{" "}
              {formatDate(selectedHandover.createdAt)}
            </div>

            {selectedHandover.aiSummary && (
              <div className="rounded-xl border border-[rgba(12,102,228,0.18)] bg-[rgba(233,242,255,0.5)] p-4">
                <div className="mb-2 text-xs font-semibold text-[color:var(--primary)]">
                  AI 브리핑
                </div>
                <p className="text-sm leading-7 text-[color:var(--text)]">
                  {selectedHandover.aiSummary}
                </p>
              </div>
            )}

            {selectedHandover.issuesSummary.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">
                  관련 이슈
                </div>
                <div className="space-y-2">
                  {selectedHandover.issuesSummary.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.title}</span>
                        <StatusBadge
                          label={item.status}
                          tone={
                            item.status === "완료" || item.status === "종결"
                              ? "success"
                              : item.status === "처리중"
                                ? "info"
                                : "default"
                          }
                        />
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {item.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedHandover.pendingItems.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">
                  미완료 항목
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm text-[color:var(--text)]">
                  {selectedHandover.pendingItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedHandover.manualNotes && (
              <div>
                <div className="mb-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  수기 메모
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text)]">
                  {selectedHandover.manualNotes}
                </p>
              </div>
            )}

            {selectedHandover.vocNotes && (
              <div>
                <div className="mb-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  이용자 의견 (VOC)
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text)]">
                  {selectedHandover.vocNotes}
                </p>
              </div>
            )}

            {selectedHandover.specialInstructions && (
              <div>
                <div className="mb-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  특별 지시사항
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text)]">
                  {selectedHandover.specialInstructions}
                </p>
              </div>
            )}

            {selectedHandover.reminders.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  알림 사항
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm text-[color:var(--text)]">
                  {selectedHandover.reminders.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Form */}
      {showForm && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI Briefing Side */}
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                AI 브리핑 생성
              </h3>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  날짜
                </span>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  근무
                </span>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as ShiftType)}
                  className="block rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm"
                >
                  {shiftOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleGenerateBriefing}
                disabled={generatingBriefing}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
                  generatingBriefing
                    ? "cursor-not-allowed bg-[color:var(--text-muted)]"
                    : "bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]",
                )}
              >
                {generatingBriefing ? "생성 중..." : "AI 브리핑 생성"}
              </button>
            </div>

            {aiBriefing ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[rgba(12,102,228,0.18)] bg-[rgba(233,242,255,0.5)] p-4">
                  <div className="mb-2 text-xs font-semibold text-[color:var(--primary)]">
                    AI 요약
                  </div>
                  <p className="text-sm leading-7 text-[color:var(--text)]">
                    {aiBriefing.aiSummary}
                  </p>
                </div>

                {aiBriefing.issuesSummary.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">
                      관련 이슈 ({aiBriefing.issuesSummary.length}건)
                    </div>
                    <div className="space-y-2">
                      {aiBriefing.issuesSummary.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {item.title}
                            </span>
                            <StatusBadge label={item.status} tone="default" />
                          </div>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {item.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiBriefing.pendingItems.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-[color:var(--text-muted)]">
                      미완료 항목
                    </div>
                    <ul className="list-inside list-disc space-y-1 text-sm text-[color:var(--warning)]">
                      {aiBriefing.pendingItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[color:var(--border)] p-8 text-center text-sm text-[color:var(--text-muted)]">
                날짜와 근무를 선택하고 &quot;AI 브리핑 생성&quot;을 클릭하세요.
                <br />
                당일 이슈와 미완료 사항을 자동으로 요약합니다.
              </div>
            )}
          </Panel>

          {/* Manual Notes Side */}
          <Panel className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              수기 인수인계
            </h3>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  수기 메모
                </span>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="인수인계할 사항을 자유롭게 기록하세요."
                  rows={4}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  이용자 의견 (VOC)
                </span>
                <textarea
                  value={vocNotes}
                  onChange={(e) => setVocNotes(e.target.value)}
                  placeholder="이용자로부터 받은 의견이나 요청 사항을 기록하세요."
                  rows={3}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  특별 지시사항
                </span>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="다음 근무자에게 전달할 특별 지시사항"
                  rows={2}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition focus:border-[color:var(--primary)] focus:bg-white"
                />
              </label>

              {/* Reminders */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  알림 사항
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reminderInput}
                    onChange={(e) => setReminderInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddReminder();
                      }
                    }}
                    placeholder="알림 사항 입력 후 Enter"
                    className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
                  />
                  <button
                    onClick={handleAddReminder}
                    className="rounded-lg bg-[color:var(--primary)] px-3 py-2 text-xs font-semibold text-white"
                  >
                    추가
                  </button>
                </div>
                {reminders.length > 0 && (
                  <div className="space-y-1">
                    {reminders.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] px-3 py-2"
                      >
                        <span className="text-sm">{r}</span>
                        <button
                          onClick={() => handleRemoveReminder(idx)}
                          className="text-xs text-[color:var(--danger)]"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition",
                  submitting
                    ? "cursor-not-allowed bg-[color:var(--text-muted)]"
                    : "bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]",
                )}
              >
                {submitting ? "저장 중..." : "인수인계 저장"}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* Handover History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
          인수인계 이력
        </h3>
        {loading ? (
          <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
            불러오는 중...
          </Panel>
        ) : handovers.length === 0 ? (
          <Panel className="p-8 text-center text-sm text-[color:var(--text-muted)]">
            인수인계 기록이 없습니다.
          </Panel>
        ) : (
          <div className="space-y-3">
            {handovers.map((handover) => (
              <button
                key={handover._id}
                type="button"
                onClick={() => {
                  setSelectedHandover(handover);
                  setShowForm(false);
                }}
                className={cn(
                  "w-full text-left rounded-2xl border p-4 transition",
                  selectedHandover?._id === handover._id
                    ? "border-[color:var(--primary)] bg-[color:var(--selected)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--primary)]",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[color:var(--text)]">
                      {handover.shiftDate}
                    </span>
                    <StatusBadge
                      label={handover.shiftType}
                      tone={
                        handover.shiftType === "야간"
                          ? "warning"
                          : handover.shiftType === "오후"
                            ? "info"
                            : "default"
                      }
                    />
                  </div>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {handover.authorName}
                  </span>
                </div>
                {handover.aiSummary && (
                  <p className="mt-2 text-sm text-[color:var(--text-muted)] line-clamp-2">
                    {handover.aiSummary}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-[color:var(--text-muted)]">
                  {handover.issuesSummary.length > 0 && (
                    <span>이슈 {handover.issuesSummary.length}건</span>
                  )}
                  {handover.pendingItems.length > 0 && (
                    <span className="text-[color:var(--warning)]">
                      미완료 {handover.pendingItems.length}건
                    </span>
                  )}
                  <span>{formatDate(handover.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
