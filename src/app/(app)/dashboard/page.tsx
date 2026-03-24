"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type DashboardData = {
  kpi: { activeClients: number; activeCases: number; runningPrograms: number; monthlyDonations: number };
  todaySchedules: { _id: string; title: string; startTime: string; endTime: string; category: string }[];
  pendingApprovals: { _id: string; documentNo: string; title: string; documentType: string }[];
  unreadCirculations: { _id: string; title: string; authorName: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j.data);
      });
  }, []);

  const kpi = data?.kpi ?? { activeClients: 0, activeCases: 0, runningPrograms: 0, monthlyDonations: 0 };
  const kpiCards = [
    { label: "활성 이용자", value: kpi.activeClients, href: "/client-case/clients" },
    { label: "진행 사례", value: kpi.activeCases, href: "/client-case/plans" },
    { label: "운영 프로그램", value: kpi.runningPrograms, href: "/programs" },
    {
      label: "이번달 후원금",
      value: `${(kpi.monthlyDonations / 10000).toFixed(0)}만원`,
      href: "/donation-volunteer/donations",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="핵심"
        title="대시보드"
        description="사회복지 ERP 현황을 한눈에 확인합니다."
      />

      {/* Top row: 3 panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">오늘의 핵심 일정</h3>
            <Link href="/schedule" className="text-xs text-[color:var(--primary)]">
              더보기
            </Link>
          </div>
          {(data?.todaySchedules ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--text-secondary)]">오늘 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data!.todaySchedules.map((s) => (
                <li key={s._id} className="flex items-center gap-2 text-sm">
                  <StatusBadge label={s.category} tone="info" />
                  <span>
                    {s.startTime}~{s.endTime}
                  </span>
                  <span className="font-medium">{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">나의 최근 결재문서</h3>
            <Link href="/approval" className="text-xs text-[color:var(--primary)]">
              더보기
            </Link>
          </div>
          {(data?.pendingApprovals ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--text-secondary)]">대기 중인 결재가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data!.pendingApprovals.map((a) => (
                <li key={a._id} className="text-sm">
                  <Link
                    href={`/approval/${a._id}`}
                    className="hover:text-[color:var(--primary)]"
                  >
                    <span className="font-mono text-xs">{a.documentNo}</span> {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">미확인 공람 문서</h3>
            <Link href="/circulation/unread" className="text-xs text-[color:var(--primary)]">
              더보기
            </Link>
          </div>
          {(data?.unreadCirculations ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--text-secondary)]">미확인 공람이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {data!.unreadCirculations.map((c) => (
                <li key={c._id} className="text-sm">
                  <Link
                    href={`/circulation/${c._id}`}
                    className="hover:text-[color:var(--primary)]"
                  >
                    {c.title}
                  </Link>
                  <span className="text-xs text-[color:var(--text-secondary)]">
                    {" "}
                    - {c.authorName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Panel className="p-4 text-center hover:border-[color:var(--primary)] transition-colors cursor-pointer">
              <div className="text-sm text-[color:var(--text-secondary)]">{c.label}</div>
              <div className="mt-1 text-2xl font-bold text-[color:var(--primary)]">
                {String(c.value)}
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </>
  );
}
