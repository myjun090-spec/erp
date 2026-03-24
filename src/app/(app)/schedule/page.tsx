"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { PermissionLink } from "@/components/auth/permission-link";

type Schedule = { _id: string; title: string; date: string; startTime: string; endTime: string; category: string };

const categoryColors: Record<string, string> = {
  "사례관리": "bg-blue-500",
  "교육": "bg-green-500",
  "회의": "bg-yellow-500",
  "외부출장": "bg-purple-500",
};

export default function ScheduleCalendarPage() {
  const router = useRouter();
  const [items, setItems] = useState<Schedule[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  useEffect(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth() + 1;
    fetch(`/api/schedules?year=${y}&month=${m}`).then(r => r.json()).then(j => { if (j.ok) setItems(j.data.items); });
  }, [currentMonth]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const prev = () => setCurrentMonth(new Date(year, month - 1, 1));
  const next = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <>
      <PageHeader eyebrow="일정관리" title="캘린더" actions={<PermissionLink permission="schedule.create" href="/schedule/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">일정 등록</PermissionLink>} />
      <Panel className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={prev} className="rounded px-3 py-1 hover:bg-[color:var(--surface)]">&lt;</button>
          <span className="font-semibold">{year}년 {month + 1}월</span>
          <button onClick={next} className="rounded px-3 py-1 hover:bg-[color:var(--surface)]">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-[color:var(--border)]">
          {["일","월","화","수","목","금","토"].map(d => <div key={d} className="bg-[color:var(--surface)] p-2 text-center text-xs font-semibold">{d}</div>)}
          {days.map((day, i) => {
            const dateStr = day ? `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
            const dayItems = items.filter(s => s.date === dateStr);
            return (
              <div key={i} className={`min-h-[80px] bg-white p-1 ${!day ? "bg-gray-50" : ""}`}>
                {day && <div className="text-xs text-gray-500">{day}</div>}
                {dayItems.slice(0, 3).map(s => (
                  <button key={s._id} onClick={() => router.push(`/schedule/${s._id}`)} className={`mt-0.5 block w-full truncate rounded px-1 text-left text-[10px] text-white ${categoryColors[s.category] || "bg-gray-400"}`}>{s.title}</button>
                ))}
                {dayItems.length > 3 && <div className="text-[10px] text-gray-400">+{dayItems.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
