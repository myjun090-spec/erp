"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type Config = { _id: string; systemCode: string; systemName: string; enabled: boolean; lastSyncAt: string | null };
const systemPaths: Record<string, string> = { himange: "/integration/himange", botame: "/integration/botame", enaradoreum: "/integration/enaradoreum", swis: "/integration/swis", vol1365: "/integration/vol1365" };

export default function IntegrationDashboard() {
  const [configs, setConfigs] = useState<Config[]>([]);
  useEffect(() => { fetch("/api/integration-configs").then(r => r.json()).then(j => { if (j.ok) setConfigs(j.data.items); }); }, []);
  return (
    <>
      <PageHeader eyebrow="연계" title="정부시스템 연계 현황" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {configs.map(c => (<Link key={c._id} href={systemPaths[c.systemCode] || "#"}><Panel className="p-4 hover:border-[color:var(--primary)] transition-colors cursor-pointer"><div className="flex items-center justify-between"><span className="font-semibold">{c.systemName}</span><StatusBadge label={c.enabled ? "연결됨" : "미연결"} tone={c.enabled ? "success" : "default"} /></div><div className="mt-2 text-xs text-[color:var(--text-secondary)]">마지막 동기화: {c.lastSyncAt || "없음"}</div></Panel></Link>))}
        {configs.length === 0 && <Panel className="col-span-full p-8 text-center text-[color:var(--text-secondary)]">연계 설정이 없습니다.</Panel>}
      </div>
    </>
  );
}