"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ totalGrant: 0, usedAmount: 0, executionRate: 0, remainingAmount: 0 });
  useEffect(() => { fetch("/api/statistics?type=finance").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "보조금 총액", value: stats.totalGrant }, { label: "집행금액", value: stats.usedAmount }, { label: "집행률", value: stats.executionRate }, { label: "미집행액", value: stats.remainingAmount }];
  return (
    <>
      <PageHeader eyebrow="통계" title="재무 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}