"use client";

import { useEffect, useState } from "react";
import { PermissionLink } from "@/components/auth/permission-link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type AccountItem = {
  _id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountCode: string | null;
  postingAllowed: boolean;
  status: string;
};

const columns = [
  { key: "code", label: "계정코드" },
  { key: "name", label: "계정명" },
  { key: "type", label: "계정유형" },
  { key: "parent", label: "상위계정" },
  { key: "posting", label: "전기가능" },
  { key: "status", label: "상태" },
];

export default function AccountsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/accounts");
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "계정과목 목록을 불러오지 못했습니다.");
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
    codeValue: item.accountCode,
    code: <span className="font-mono text-[color:var(--primary)]">{item.accountCode}</span>,
    name: <span className="font-medium">{item.accountName}</span>,
    type: item.accountType,
    parent: item.parentAccountCode ? <span className="font-mono">{item.parentAccountCode}</span> : "-",
    posting: item.postingAllowed ? "Y" : "N",
    status: <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "default"} />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="계정과목 목록"
        description="계정과목 체계를 관리합니다."
        meta={[
          { label: "Database", tone: "success" },
          { label: "Team 2", tone: "success" },
        ]}
        actions={
          <PermissionLink
            permission="account.create"
            href="/finance/accounts/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            계정과목 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="계정과목"
        description="계정과목 마스터입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/finance/accounts/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.codeValue)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "계정과목 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 계정과목이 없습니다" }}
      />
    </>
  );
}
