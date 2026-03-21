"use client";
import { useEffect, useState } from "react";

export type ProjectOption = { _id: string; code: string; name: string; projectType: string };

export function useProjects() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(j => {
      if (j.ok) setProjects(j.data.items.map((p: ProjectOption & Record<string, unknown>) => ({ _id: p._id, code: p.code, name: p.name, projectType: p.projectType })));
    }).catch(() => {});
  }, []);
  return projects;
}

export const ACTION_TYPE_OPTIONS = [
  { label: "인허가", value: "license" },
  { label: "검사", value: "inspection" },
  { label: "보고", value: "report" },
  { label: "제출", value: "submission" },
  { label: "종결", value: "closure" },
  { label: "질의", value: "query" },
];

export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type DocRef = { refNo: string; title: string };

export function DocRefList({ rows, onChange }: { rows: DocRef[]; onChange: (rows: DocRef[]) => void }) {
  const addRow = () => onChange([...rows, { refNo: "", title: "" }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, key: keyof DocRef, value: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[color:var(--text)]">관련 문서</h3>
        <button type="button" onClick={addRow}
          className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-muted)]">
          + 문서 추가
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)]">등록된 관련 문서가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.refNo}
                onChange={e => updateRow(i, "refNo", e.target.value)}
                placeholder="문서번호 (예: DOC-001)"
                className="w-40 shrink-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm font-mono outline-none focus:border-[color:var(--primary)] focus:bg-white"
              />
              <input
                value={row.title}
                onChange={e => updateRow(i, "title", e.target.value)}
                placeholder="문서 제목"
                className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)] focus:bg-white"
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
