"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type LinkageItem = {
  _id: string;
  linkageNo: string;
  clientSnapshot: { name: string } | null;
  linkageType: string;
  serviceCategory: string;
  referralOrg: string;
  referralDate: string;
  status: string;
};

const columns = [
  { key: "linkageNo", label: "연계번호" },
  { key: "clientName", label: "이용자" },
  { key: "linkageType", label: "연계유형" },
  { key: "serviceCategory", label: "서비스분류" },
  { key: "referralOrg", label: "연계기관" },
  { key: "referralDate", label: "연계일" },
  { key: "status", label: "상태" },
];

const statusToneMap: Record<string, "success" | "default" | "info" | "danger"> = {
  requested: "default",
  connected: "info",
  completed: "success",
  failed: "danger",
};

export default function LinkagesPage() {
  const router = useRouter();
  const [items, setItems] = useState<LinkageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/service-linkages");
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "서비스연계 목록을 불러오지 못했습니다.");
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
    linkageNo: <span className="font-mono text-[color:var(--primary)]">{item.linkageNo}</span>,
    clientName: <span className="font-medium">{item.clientSnapshot?.name || "-"}</span>,
    linkageType: item.linkageType || "-",
    serviceCategory: item.serviceCategory || "-",
    referralOrg: item.referralOrg || "-",
    referralDate: item.referralDate || "-",
    status: (
      <StatusBadge
        label={item.status}
        tone={statusToneMap[item.status] ?? "default"}
      />
    ),
  }));

  return (
    <>
      <PageHeader
        eyebrow="서비스연계"
        title="서비스연계 목록"
        description="서비스연계 기록을 관리합니다."
        actions={
          <PermissionLink
            permission="service-linkage.create"
            href="/client-case/linkages/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            서비스연계 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="서비스연계"
        description="서비스연계 기록입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/client-case/linkages/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.id)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "서비스연계 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 서비스연계가 없습니다" }}
      />
    </>
  );
}
