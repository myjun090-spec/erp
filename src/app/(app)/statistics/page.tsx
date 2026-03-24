"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ totalClients: 0, activeClients: 0, newThisMonth: 0, closedThisMonth: 0 });
  useEffect(() => { fetch("/api/statistics?type=clients").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "전체 이용자", value: stats.totalClients }, { label: "활성 이용자", value: stats.activeClients }, { label: "이번달 신규", value: stats.newThisMonth }, { label: "이번달 종결", value: stats.closedThisMonth }];
  return (
    <>
      <PageHeader eyebrow="통계" title="이용자 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}