"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ monthlyDonation: 0, donorCount: 0, volunteerCount: 0, totalVolunteerHours: 0 });
  useEffect(() => { fetch("/api/statistics?type=donations").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "이번달 후원금", value: stats.monthlyDonation }, { label: "후원자수", value: stats.donorCount }, { label: "봉사자수", value: stats.volunteerCount }, { label: "봉사시간", value: stats.totalVolunteerHours }];
  return (
    <>
      <PageHeader eyebrow="통계" title="후원/봉사 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}