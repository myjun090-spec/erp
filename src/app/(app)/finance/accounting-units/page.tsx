"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type AccountingUnitItem = {
  _id: string;
  code: string;
  name: string;
  currency: string;
  country: string;
  fiscalYearStartMonth: number;
  status: string;
};

const columns = [
  { key: "code", label: "코드" },
  { key: "name", label: "회계단위명" },
  { key: "currency", label: "통화" },
  { key: "country", label: "국가" },
  { key: "fyStart", label: "회계연도시작" },
  { key: "status", label: "상태" },
];

export default function AccountingUnitsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AccountingUnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/accounting-units");
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "회계단위 목록을 불러오지 못했습니다.");
          return;
        }
        setItems(json.data.items);
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const rows = items.map((item) => ({
    id: item._id,
    codeValue: item.code,
    code: <span className="font-mono text-[color:var(--primary)]">{item.code}</span>,
    name: <span className="font-medium">{item.name}</span>,
    currency: item.currency,
    country: item.country,
    fyStart: `${item.fiscalYearStartMonth}월`,
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="회계단위 목록"
        description="회계단위를 관리하고 회계기간을 설정합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Team 2", tone: "success" },
        ]}
        actions={
          <PermissionLink
            permission="accounting-unit.create"
            href="/finance/accounting-units/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            회계단위 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="회계단위"
        description="등록된 회계단위 목록입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/finance/accounting-units/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.codeValue)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "회계단위 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 회계단위가 없습니다" }}
      />
    </>
  );
}
