"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActionTable } from "@/components/ui/bulk-action-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";

type ClientItem = {
  _id: string;
  clientNo: string;
  name: string;
  gender: string;
  birthDate: string;
  careLevel: string;
  incomeLevel: string;
  status: string;
};

const columns = [
  { key: "clientNo", label: "이용자번호" },
  { key: "name", label: "이름" },
  { key: "gender", label: "성별" },
  { key: "birthDate", label: "생년월일" },
  { key: "careLevel", label: "돌봄등급" },
  { key: "incomeLevel", label: "소득수준" },
  { key: "status", label: "상태" },
];

const statusFilterOptions = [
  { label: "전체", value: "" },
  { label: "활성", value: "active" },
  { label: "비활성", value: "inactive" },
  { label: "전출", value: "transferred" },
  { label: "사망", value: "deceased" },
];

const statusToneMap: Record<string, "success" | "default" | "warning" | "danger"> = {
  active: "success",
  inactive: "default",
  transferred: "warning",
  deceased: "danger",
};

export default function ClientsPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [items, setItems] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "이용자 목록을 불러오지 못했습니다.");
        return;
      }
      setItems(json.data.items);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filtered = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.clientNo.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const rows = filtered.map((item) => ({
    id: item._id,
    clientNo: <span className="font-mono text-[color:var(--primary)]">{item.clientNo}</span>,
    name: <span className="font-medium">{item.name}</span>,
    gender: item.gender || "-",
    birthDate: item.birthDate || "-",
    careLevel: item.careLevel || "-",
    incomeLevel: item.incomeLevel || "-",
    status: (
      <StatusBadge
        label={item.status}
        tone={statusToneMap[item.status] ?? "default"}
      />
    ),
  }));

  const handleBulkAction = async (action: string, targetIds: string[]) => {
    try {
      const res = await fetch("/api/clients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetIds }),
      });
      const json = await res.json();
      if (!json.ok) {
        pushToast({
          title: "처리 실패",
          description: json.message || "대량 작업에 실패했습니다.",
          tone: "warning",
        });
        return;
      }
      pushToast({
        title: "처리 완료",
        description: `${json.affectedCount}건이 처리되었습니다.`,
        tone: "success",
      });
      void fetchData();
    } catch {
      pushToast({
        title: "처리 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="이용자"
        title="이용자 목록"
        description="등록된 이용자를 관리합니다."
        actions={
          <PermissionLink
            permission="client.create"
            href="/client-case/clients/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            이용자 등록
          </PermissionLink>
        }
      />
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="이름 또는 이용자번호 검색"
        filters={[
          {
            key: "status",
            label: "상태",
            value: statusFilter,
            options: statusFilterOptions,
          },
        ]}
        onFilterChange={(_key, value) => setStatusFilter(value)}
        summary={`${filtered.length}건`}
      />
      <BulkActionTable
        title="이용자"
        description="이용자 마스터입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/client-case/clients/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.id)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "이용자 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 이용자가 없습니다" }}
        bulkActions={[
          {
            key: "activate",
            label: "활성화",
            tone: "success",
            confirmTitle: "선택한 이용자를 활성화할까요?",
            confirmDescription: "선택한 이용자의 상태를 활성으로 변경합니다.",
            confirmLabel: "활성화",
            onAction: (ids) => handleBulkAction("activate", ids),
          },
          {
            key: "deactivate",
            label: "비활성화",
            tone: "warning",
            confirmTitle: "선택한 이용자를 비활성화할까요?",
            confirmDescription: "선택한 이용자의 상태를 비활성으로 변경합니다.",
            confirmLabel: "비활성화",
            onAction: (ids) => handleBulkAction("deactivate", ids),
          },
        ]}
      />
    </>
  );
}
