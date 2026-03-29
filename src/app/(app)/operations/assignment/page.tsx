"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";
import type {
  OpsIssue,
  OpsStaff,
  StaffAssignmentSuggestion,
  StaffSkill,
  ShiftType,
} from "@/types/operations";

const allSkills: StaffSkill[] = [
  "시설관리", "안전관리", "사회복지", "상담", "행정", "의료/간호", "프로그램운영", "IT/정보", "차량운전",
];

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const shiftOptions: ShiftType[] = ["오전", "오후", "야간", "휴무"];

export default function AssignmentPage() {
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [staffList, setStaffList] = useState<OpsStaff[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [suggestions, setSuggestions] = useState<StaffAssignmentSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [assigning, setAssigning] = useState("");

  // Staff form
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "", email: "", role: "", department: "", phone: "",
    skills: [] as StaffSkill[],
    schedule: dayLabels.map((_, i) => ({ dayOfWeek: i, shift: "휴무" as ShiftType })),
  });

  useEffect(() => {
    fetch("/api/operations/issues?status=접수")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          // Include issues with status 접수, 분석중, or 배정됨
          setIssues(j.data.items);
        }
      });
    // Also fetch all unassigned issues
    fetch("/api/operations/issues")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setIssues(j.data.items.filter((i: OpsIssue) => !["완료", "종결"].includes(i.status)));
        }
      });
    loadStaff();
  }, []);

  function loadStaff() {
    fetch("/api/operations/staff")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setStaffList(j.data.items);
      });
  }

  async function handleGetSuggestions() {
    if (!selectedIssueId) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/operations/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: selectedIssueId }),
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
      const res = await fetch(`/api/operations/issues/${selectedIssueId}/assign`, {
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
        // Remove assigned issue from list
        setIssues((prev) => prev.filter((i) => i._id !== selectedIssueId));
        setSelectedIssueId("");
        setSuggestions([]);
        loadStaff();
      }
    } finally {
      setAssigning("");
    }
  }

  async function handleAddStaff() {
    if (!staffForm.name.trim()) return;
    try {
      const res = await fetch("/api/operations/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });
      const data = await res.json();
      if (data.ok) {
        setShowStaffForm(false);
        setStaffForm({
          name: "", email: "", role: "", department: "", phone: "",
          skills: [],
          schedule: dayLabels.map((_, i) => ({ dayOfWeek: i, shift: "휴무" as ShiftType })),
        });
        loadStaff();
      }
    } catch {
      // Silently handle
    }
  }

  const selectedIssue = issues.find((i) => i._id === selectedIssueId);

  return (
    <>
      <PageHeader
        eyebrow="AI 운영"
        title="직원배정"
        description="AI가 이슈에 적합한 담당자를 추천합니다."
        actions={
          <button
            onClick={() => setShowStaffForm(!showStaffForm)}
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--primary-hover)]"
          >
            {showStaffForm ? "닫기" : "직원 등록"}
          </button>
        }
      />

      {/* Staff Registration Form */}
      {showStaffForm && (
        <Panel className="p-6">
          <h3 className="mb-4 font-semibold">운영 직원 등록</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="이름" required value={staffForm.name} onChange={(v) => setStaffForm({ ...staffForm, name: v })} />
            <FormField label="이메일" value={staffForm.email} onChange={(v) => setStaffForm({ ...staffForm, email: v })} />
            <FormField label="직책" value={staffForm.role} onChange={(v) => setStaffForm({ ...staffForm, role: v })} placeholder="예: 사회복지사" />
            <FormField label="부서" value={staffForm.department} onChange={(v) => setStaffForm({ ...staffForm, department: v })} placeholder="예: 서비스팀" />
            <FormField label="연락처" value={staffForm.phone} onChange={(v) => setStaffForm({ ...staffForm, phone: v })} placeholder="010-0000-0000" />
          </div>

          {/* Skills */}
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">역량</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {allSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => {
                    setStaffForm((prev) => ({
                      ...prev,
                      skills: prev.skills.includes(skill)
                        ? prev.skills.filter((s) => s !== skill)
                        : [...prev.skills, skill],
                    }));
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    staffForm.skills.includes(skill)
                      ? "border-[color:var(--primary)] bg-[color:var(--selected)] text-[color:var(--primary)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]",
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="mt-4">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">근무 일정</span>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {dayLabels.map((day, i) => (
                <div key={day} className="text-center">
                  <div className="mb-1 text-xs font-medium text-[color:var(--text-muted)]">{day}</div>
                  <select
                    value={staffForm.schedule[i].shift}
                    onChange={(e) => {
                      const newSchedule = [...staffForm.schedule];
                      newSchedule[i] = { dayOfWeek: i, shift: e.target.value as ShiftType };
                      setStaffForm({ ...staffForm, schedule: newSchedule });
                    }}
                    className="w-full rounded-lg border border-[color:var(--border)] px-1 py-1.5 text-xs"
                  >
                    {shiftOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddStaff}
            className="mt-4 rounded-xl bg-[color:var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
          >
            직원 저장
          </button>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Issue Selection */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            미배정 이슈 ({issues.length}건)
          </h3>
          {issues.length === 0 ? (
            <Panel className="p-6 text-center text-sm text-[color:var(--text-muted)]">
              미배정 이슈가 없습니다.
            </Panel>
          ) : (
            issues.map((issue) => (
              <button
                key={issue._id}
                type="button"
                onClick={() => {
                  setSelectedIssueId(issue._id);
                  setSuggestions([]);
                }}
                className={cn(
                  "w-full text-left rounded-2xl border p-4 transition",
                  selectedIssueId === issue._id
                    ? "border-[color:var(--primary)] bg-[color:var(--selected)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--primary)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{issue.title}</span>
                  {issue.aiAnalysis && (
                    <StatusBadge label={issue.aiAnalysis.category} tone="info" />
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--text-muted)] line-clamp-1">{issue.description}</p>
              </button>
            ))
          )}
        </div>

        {/* Staff Suggestion */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              AI 추천 담당자
            </h3>
            <button
              onClick={handleGetSuggestions}
              disabled={!selectedIssueId || loadingSuggestions}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition",
                selectedIssueId && !loadingSuggestions
                  ? "bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)]"
                  : "cursor-not-allowed bg-[color:var(--border)] text-[color:var(--text-muted)]",
              )}
            >
              {loadingSuggestions ? "분석 중..." : "AI 추천 요청"}
            </button>
          </div>

          {selectedIssue && (
            <Panel className="p-4">
              <div className="text-xs text-[color:var(--text-muted)]">선택된 이슈</div>
              <div className="mt-1 font-medium">{selectedIssue.title}</div>
              {selectedIssue.aiAnalysis && (
                <div className="mt-2 flex gap-2">
                  <StatusBadge label={selectedIssue.aiAnalysis.category} tone="info" />
                  <StatusBadge label={selectedIssue.aiAnalysis.urgency} tone="warning" />
                </div>
              )}
            </Panel>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, idx) => (
                <Panel key={s.staffId || idx} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[color:var(--primary)]">#{idx + 1}</span>
                        <span className="font-semibold">{s.staffName}</span>
                        {s.isOnShift && (
                          <StatusBadge label="근무중" tone="success" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div
                            className="h-2 rounded-full bg-[color:var(--primary)]"
                            style={{ width: `${s.matchScore}px` }}
                          />
                          <span className="text-xs font-bold text-[color:var(--primary)]">
                            {s.matchScore}점
                          </span>
                        </div>
                        <span className="text-xs text-[color:var(--text-muted)]">
                          현재 {s.currentLoad}건 처리중
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
                        {s.reason}
                      </p>
                      {s.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.skills.map((sk) => (
                            <span key={sk} className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
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
                </Panel>
              ))}
            </div>
          )}

          {/* Staff List */}
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            전체 직원 ({staffList.length}명)
          </h3>
          {staffList.length === 0 ? (
            <Panel className="p-6 text-center text-sm text-[color:var(--text-muted)]">
              등록된 직원이 없습니다. 위 &quot;직원 등록&quot; 버튼으로 추가하세요.
            </Panel>
          ) : (
            staffList.map((staff) => (
              <Panel key={staff._id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{staff.name}</span>
                    <span className="ml-2 text-xs text-[color:var(--text-muted)]">{staff.role} / {staff.department}</span>
                  </div>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    이슈 {staff.currentLoad}건
                  </span>
                </div>
                {staff.skills.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {staff.skills.map((sk) => (
                      <span key={sk} className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-muted)]">
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </Panel>
            ))
          )}
        </div>
      </div>
    </>
  );
}
