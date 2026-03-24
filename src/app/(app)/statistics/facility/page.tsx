"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
export default function Page() {
  const [stats, setStats] = useState<Record<string, number>>({ staffCount: 0, roomCount: 0, supplyCount: 0, vehicleCount: 0 });
  useEffect(() => { fetch("/api/statistics?type=facility").then(r => r.json()).then(j => { if (j.ok) setStats(j.data); }); }, []);
  const cards = [{ label: "직원수", value: stats.staffCount }, { label: "시설수", value: stats.roomCount }, { label: "비품항목", value: stats.supplyCount }, { label: "차량수", value: stats.vehicleCount }];
  return (
    <>
      <PageHeader eyebrow="통계" title="시설 통계" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (<Panel key={c.label} className="p-4 text-center"><div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div><div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">{String(c.value)}</div></Panel>))}
      </div>
    </>
  );
}