"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ running: 0, completed: 0, avgParticipation: 0, avgSatisfaction: 0 });
  useEffect(() => { fetch("/api/statistics?type=programs").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "운영중", value: stats.running }, { label: "완료", value: stats.completed }, { label: "평균참여율", value: stats.avgParticipation }, { label: "평균만족도", value: stats.avgSatisfaction }];
  return (
    <>
      <PageHeader eyebrow="통계" title="프로그램 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}