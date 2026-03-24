"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type Log = { _id: string; direction: string; status: string; createdAt: string; errorMessage?: string };

export default function Page() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/integration-logs?systemCode=vol1365").then(r => r.json()).then(j => { if (j.ok) setLogs(j.data.items); }).finally(() => setLoading(false)); }, []);
  const columns = [{ key: "direction", label: "방향" }, { key: "status", label: "상태" }, { key: "date", label: "일시" }, { key: "error", label: "오류" }];
  const rows = logs.map(l => ({ id: l._id, direction: l.direction === "inbound" ? "수신" : "송신", status: <StatusBadge label={l.status} tone={l.status === "success" ? "success" : "default"} />, date: l.createdAt?.slice(0, 16) ?? "-", error: l.errorMessage || "-" }));
  return (
    <>
      <PageHeader eyebrow="정부시스템 연계" title="1365 자원봉사포털" description="봉사자 등록 연동" />
      <Panel className="p-4 mb-4"><div className="flex items-center justify-between"><div><div className="font-semibold">1365 자원봉사포털 연동 설정</div><div className="text-sm text-[color:var(--text-secondary)]">API 연동 상태 및 동기화 로그</div></div><button className="rounded-full border border-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-[color:var(--primary)]">수동 동기화</button></div></Panel>
      <DataTable title="동기화 로그" columns={columns} rows={rows} getRowKey={r => String(r.id)} loading={loading} emptyState={{ title: "동기화 이력이 없습니다" }} />
    </>
  );
}