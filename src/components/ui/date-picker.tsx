"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type DatePickerProps = {
  label: string;
  value: string; // YYYY-MM-DD 또는 ""
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
};

type CalView = "days" | "months" | "years";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function parseYMD(str: string): { y: number; m: number; d: number } | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toYMD(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDisplay(str: string): string {
  const p = parseYMD(str);
  if (!p) return "";
  return `${p.y}년 ${p.m}월 ${p.d}일`;
}

export function DatePicker({
  label, value, onChange, required, error, placeholder, className,
}: DatePickerProps) {
  const today = new Date();
  const todayYMD = toYMD(today);
  const parsed = parseYMD(value);

  const [open, setOpen] = useState(false);
  const [calView, setCalView] = useState<CalView>("days");
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.m - 1 : today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // years 뷰의 시작 연도 (12개씩 묶음)
  const yearRangeStart = Math.floor(viewYear / 12) * 12;

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCalView("days");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 외부 value 변경 시 뷰 동기화
  useEffect(() => {
    const p = parseYMD(value);
    if (p) { setViewYear(p.y); setViewMonth(p.m - 1); }
  }, [value]);

  const openCalendar = () => {
    setCalView("days");
    setOpen(o => !o);
  };

  // ── days 뷰 헬퍼 ──────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dayCells: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];

  // ── 공통 드롭다운 헤더 ────────────────────────────────
  const NavHeader = ({
    label: headerLabel,
    onPrev, onNext, onLabelClick, labelClickable = false,
  }: {
    label: string;
    onPrev: () => void;
    onNext: () => void;
    onLabelClick?: () => void;
    labelClickable?: boolean;
  }) => (
    <div className="mb-3 flex items-center justify-between">
      <button type="button" onClick={onPrev}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-base text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]">
        ‹
      </button>
      <button
        type="button"
        onClick={onLabelClick}
        className={cn(
          "rounded-lg px-2 py-0.5 text-sm font-semibold text-[color:var(--text)] transition",
          labelClickable && "hover:bg-[color:var(--surface-muted)] cursor-pointer",
        )}
      >
        {headerLabel}
      </button>
      <button type="button" onClick={onNext}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-base text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]">
        ›
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative block space-y-2", className)}>
      {/* 레이블 */}
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
        {label}
        {required && <span className="ml-1 text-[color:var(--danger)]">*</span>}
      </span>

      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={openCalendar}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm outline-none transition hover:bg-white",
          error ? "border-[color:var(--danger)]"
            : open ? "border-[color:var(--primary)] bg-white"
            : "border-[color:var(--border)]",
        )}
      >
        <span className={value ? "text-[color:var(--text)]" : "text-[color:var(--text-muted)]"}>
          {value ? formatDisplay(value) : (placeholder ?? "날짜 선택")}
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
          className="shrink-0 text-[color:var(--text-muted)]">
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {error && <span className="text-[11px] font-medium text-[color:var(--danger)]">{error}</span>}

      {/* 캘린더 드롭다운 */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-xl shadow-black/10">

          {/* ── DAYS 뷰 ── */}
          {calView === "days" && (
            <>
              <NavHeader
                label={`${viewYear}년 ${MONTH_LABELS[viewMonth]}`}
                onPrev={prevMonth}
                onNext={nextMonth}
                onLabelClick={() => setCalView("months")}
                labelClickable
              />
              {/* 요일 헤더 */}
              <div className="mb-1 grid grid-cols-7">
                {DAY_LABELS.map((day, i) => (
                  <div key={day} className={cn(
                    "py-1 text-center text-[10px] font-semibold tracking-wide",
                    i === 0 ? "text-[color:var(--danger)]" : i === 6 ? "text-[color:var(--primary)]" : "text-[color:var(--text-muted)]",
                  )}>
                    {day}
                  </div>
                ))}
              </div>
              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {dayCells.map((date, i) => {
                  if (!date) return <div key={`blank-${i}`} />;
                  const ymd = toYMD(date);
                  const isSelected = ymd === value;
                  const isToday = ymd === todayYMD;
                  const isSun = date.getDay() === 0;
                  const isSat = date.getDay() === 6;
                  return (
                    <button key={ymd} type="button" onClick={() => { onChange(ymd); setOpen(false); }}
                      className={cn(
                        "flex h-8 w-full items-center justify-center rounded-lg text-sm transition",
                        isSelected ? "bg-[color:var(--primary)] font-semibold text-white"
                          : isToday ? "border border-[color:var(--primary)] font-semibold text-[color:var(--primary)]"
                          : isSun ? "text-[color:var(--danger)] hover:bg-[color:var(--surface-muted)]"
                          : isSat ? "text-[color:var(--primary)] hover:bg-[color:var(--surface-muted)]"
                          : "text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]",
                      )}>
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              {/* 오늘 바로가기 */}
              <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                <button type="button"
                  onClick={() => { onChange(todayYMD); setOpen(false); }}
                  className="w-full rounded-xl bg-[color:var(--surface-muted)] py-1.5 text-xs font-semibold text-[color:var(--text)] transition hover:bg-[color:var(--border)]">
                  오늘
                </button>
              </div>
            </>
          )}

          {/* ── MONTHS 뷰 ── */}
          {calView === "months" && (
            <>
              <NavHeader
                label={`${viewYear}년`}
                onPrev={() => setViewYear(y => y - 1)}
                onNext={() => setViewYear(y => y + 1)}
                onLabelClick={() => setCalView("years")}
                labelClickable
              />
              <div className="grid grid-cols-3 gap-2">
                {MONTH_LABELS.map((mon, i) => {
                  const isCurrentMonth = i === viewMonth && viewYear === (parseYMD(value)?.y ?? -1) &&
                    i === (parseYMD(value) ? parseYMD(value)!.m - 1 : -1);
                  const isSelectedMonth = value
                    ? (parseYMD(value)?.y === viewYear && parseYMD(value)?.m === i + 1)
                    : false;
                  const isTodayMonth = today.getFullYear() === viewYear && today.getMonth() === i;
                  return (
                    <button key={mon} type="button"
                      onClick={() => { setViewMonth(i); setCalView("days"); }}
                      className={cn(
                        "rounded-xl py-2 text-sm font-medium transition",
                        isSelectedMonth ? "bg-[color:var(--primary)] text-white"
                          : isTodayMonth ? "border border-[color:var(--primary)] text-[color:var(--primary)]"
                          : "text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]",
                      )}>
                      {mon}
                    </button>
                  );
                  void isCurrentMonth;
                })}
              </div>
            </>
          )}

          {/* ── YEARS 뷰 ── */}
          {calView === "years" && (
            <>
              <NavHeader
                label={`${yearRangeStart} – ${yearRangeStart + 11}`}
                onPrev={() => setViewYear(yearRangeStart - 1)}
                onNext={() => setViewYear(yearRangeStart + 12)}
              />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(yr => {
                  const isSelectedYear = parseYMD(value)?.y === yr;
                  const isTodayYear = today.getFullYear() === yr;
                  return (
                    <button key={yr} type="button"
                      onClick={() => { setViewYear(yr); setCalView("months"); }}
                      className={cn(
                        "rounded-xl py-2 text-sm font-medium transition",
                        isSelectedYear ? "bg-[color:var(--primary)] text-white"
                          : isTodayYear ? "border border-[color:var(--primary)] text-[color:var(--primary)]"
                          : "text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]",
                      )}>
                      {yr}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
