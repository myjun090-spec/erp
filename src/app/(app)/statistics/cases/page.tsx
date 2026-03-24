"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ activeCases: 0, completedCases: 0, serviceLinkages: 0, counselingCount: 0 });
  useEffect(() => { fetch("/api/statistics?type=cases").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "진행 사례", value: stats.activeCases }, { label: "완료 사례", value: stats.completedCases }, { label: "서비스연계", value: stats.serviceLinkages }, { label: "상담건수", value: stats.counselingCount }];
  return (
    <>
      <PageHeader eyebrow="통계" title="사례관리 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}