"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import type { IssueAiAnalysis, IssueCategory, IssueUrgency } from "@/types/operations";

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

export default function NewIssuePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState<IssueAiAnalysis | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("제목과 내용을 입력하세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/operations/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          imageUrls: imagePreview ? [imagePreview] : [],
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setAiResult(data.data.aiAnalysis);
        // Wait briefly to show the analysis, then redirect
        setTimeout(() => {
          router.push("/operations/issues");
        }, 3000);
      } else {
        setError(data.message || "이슈 등록에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title="이슈 등록"
        description="시설 운영 이슈를 등록하면 AI가 자동으로 분석합니다."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <Panel className="p-6 lg:col-span-2">
          <div className="space-y-4">
            <FormField
              label="이슈 제목"
              required
              value={title}
              onChange={setTitle}
              placeholder="예: 2층 복도 누수 발생"
            />

            <FormField
              label="상세 내용"
              required
              type="textarea"
              value={description}
              onChange={setDescription}
              placeholder="발생 상황을 상세히 설명해주세요. (언제, 어디서, 어떤 상황인지)"
              rows={6}
            />

            <FormField
              label="발생 위치"
              value={location}
              onChange={setLocation}
              placeholder="예: 2층 복도, 프로그램실 A"
            />

            {/* Image Upload */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                사진 첨부
              </span>
              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  사진 선택
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="h-20 w-20 rounded-lg border border-[color:var(--border)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--danger)] text-xs text-white"
                    >
                      x
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-[rgba(201,55,44,0.1)] px-4 py-2 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition",
                  submitting
                    ? "cursor-not-allowed bg-[color:var(--text-muted)]"
                    : "bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]",
                )}
              >
                {submitting ? "AI 분석 중..." : "등록 및 AI 분석"}
              </button>
              <button
                onClick={() => router.back()}
                className="rounded-xl border border-[color:var(--border)] px-6 py-2.5 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]"
              >
                취소
              </button>
            </div>
          </div>
        </Panel>

        {/* AI Analysis Result */}
        <Panel className="p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            AI 분석 결과
          </h3>
          {aiResult ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs text-[color:var(--text-muted)]">카테고리</div>
                <StatusBadge
                  label={aiResult.category}
                  tone={categoryTone[aiResult.category] ?? "default"}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-[color:var(--text-muted)]">긴급도</div>
                <StatusBadge
                  label={aiResult.urgency}
                  tone={urgencyTone[aiResult.urgency] ?? "warning"}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-[color:var(--text-muted)]">위험도</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-3 w-6 rounded-sm",
                        i <= aiResult.riskLevel
                          ? aiResult.riskLevel >= 4
                            ? "bg-[color:var(--danger)]"
                            : aiResult.riskLevel >= 3
                              ? "bg-[color:var(--warning)]"
                              : "bg-[color:var(--success)]"
                          : "bg-[color:var(--border)]",
                      )}
                    />
                  ))}
                  <span className="ml-2 text-sm font-bold">{aiResult.riskLevel}/5</span>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-[color:var(--text-muted)]">분석 요약</div>
                <p className="text-sm leading-6 text-[color:var(--text)]">
                  {aiResult.summary}
                </p>
              </div>
              <div>
                <div className="mb-1 text-xs text-[color:var(--text-muted)]">권고 조치</div>
                <p className="text-sm leading-6 text-[color:var(--text)]">
                  {aiResult.recommendedAction}
                </p>
              </div>
              <div className="rounded-lg bg-[rgba(31,132,90,0.1)] px-3 py-2 text-xs text-[color:var(--success)]">
                등록 완료. 이슈 목록으로 이동합니다...
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
              <p>이슈를 등록하면 AI가 자동으로 분석합니다.</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>카테고리 자동 분류</li>
                <li>긴급도 판단</li>
                <li>위험도 평가 (1~5)</li>
                <li>권고 조치 제시</li>
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
