"use client";
import { useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";

export type ProjectOption = { _id: string; code: string; name: string; projectType: string };
export type SiteOption = { _id: string; code: string; name: string; projectSnapshot: { projectId: string; code: string; name: string } | null };

export function useSites() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  useEffect(() => {
    fetch("/api/projects/sites").then(r => r.json()).then(j => {
      if (j.ok) setSites(j.data.items.map((s: SiteOption & Record<string, unknown>) => ({
        _id: s._id, code: s.code, name: s.name, projectSnapshot: s.projectSnapshot ?? null,
      })));
    }).catch(() => {});
  }, []);
  return sites;
}

export type CurrentUser = { displayName: string; orgUnitName: string; email: string };

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(j => {
      if (j.ok) setUser(j.data);
    }).catch(() => {});
  }, []);
  return user;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(j => {
      if (j.ok) setProjects(j.data.items.map((p: ProjectOption & Record<string, unknown>) => ({ _id: p._id, code: p.code, name: p.name, projectType: p.projectType })));
    }).catch(() => {});
  }, []);
  return projects;
}

export const INCIDENT_TYPE_OPTIONS = [
  { label: "아차사고", value: "near-miss" },
  { label: "경상", value: "minor" },
  { label: "중상", value: "major" },
  { label: "사망", value: "fatality" },
];

export const SEVERITY_OPTIONS = [
  { label: "낮음", value: "low" },
  { label: "보통", value: "medium" },
  { label: "높음", value: "high" },
  { label: "위험", value: "critical" },
];

export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  "near-miss": "아차사고", minor: "경상", major: "중상", fatality: "사망",
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: "낮음", medium: "보통", high: "높음", critical: "위험",
};

export const SEVERITY_TONE: Record<string, "default" | "info" | "warning" | "danger"> = {
  low: "info", medium: "default", high: "warning", critical: "danger",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "접수", investigating: "조사중", closed: "종결",
};

export const STATUS_TONE: Record<string, "warning" | "info" | "success"> = {
  open: "warning", investigating: "info", closed: "success",
};

export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type CorrectiveAction = { code: string; description: string; dueDate: string; status: string };

export function CorrectiveActionList({ rows, onChange }: { rows: CorrectiveAction[]; onChange: (rows: CorrectiveAction[]) => void }) {
  const addRow = () => onChange([...rows, { code: "", description: "", dueDate: "", status: "open" }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, key: keyof CorrectiveAction, value: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[color:var(--text)]">시정조치</h3>
        <button type="button" onClick={addRow}
          className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]">
          + 시정조치 추가
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)]">등록된 시정조치가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={row.code}
                onChange={e => updateRow(i, "code", e.target.value)}
                placeholder="코드 (예: CA-001)"
                className="w-36 shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 font-mono text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
              />
              <input
                value={row.description}
                onChange={e => updateRow(i, "description", e.target.value)}
                placeholder="시정조치 내용"
                className="min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
              />
              <DatePicker
                label=""
                value={row.dueDate}
                onChange={v => updateRow(i, "dueDate", v)}
                className="w-36 shrink-0"
              />
              <button type="button" onClick={() => removeRow(i)}
                className="shrink-0 rounded-xl border border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)] hover:bg-[rgba(220,38,38,0.06)]">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
