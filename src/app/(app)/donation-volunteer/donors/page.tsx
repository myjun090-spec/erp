"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { useFacilitySelection } from "@/components/layout/facility-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendFacilityIdToPath } from "@/lib/facility-scope";

type DonorItem = {
  _id: string;
  donorNo: string;
  donorType: string;
  name: string;
  phone: string;
  donorCategory: string;
  preferredUsage: string;
  status: string;
};

const columns = [
  { key: "donorNo", label: "후원자번호" },
  { key: "name", label: "후원자명" },
  { key: "donorType", label: "유형" },
  { key: "phone", label: "연락처" },
  { key: "donorCategory", label: "후원구분" },
  { key: "preferredUsage", label: "용도지정" },
  { key: "status", label: "상태" },
];

function getStatusTone(status: string) {
  switch (status) {
    case "active": return "success";
    case "inactive": return "warning";
    case "archived": return "default";
    default: return "default";
  }
}

export default function DonorsPage() {
  const router = useRouter();
  const [items, setItems] = useState<DonorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentFacilityId } = useFacilitySelection();

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(appendFacilityIdToPath("/api/donors", currentFacilityId));
      const json = await res.json();
      if (json.ok) setItems(json.data.items);
      else setError(json.message);
    } catch { setError("네트워크 오류가 발생했습니다."); } finally { setLoading(false); }
  }, [currentFacilityId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const rows = items.map((item) => ({
    id: item._id,
    donorNo: <span className="font-mono text-[color:var(--primary)]">{item.donorNo}</span>,
    name: <span className="font-medium">{item.name}</span>,
    donorType: item.donorType,
    phone: item.phone || "-",
    donorCategory: item.donorCategory || "-",
    preferredUsage: item.preferredUsage || "-",
    status: <StatusBadge label={item.status} tone={getStatusTone(item.status)} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Donation & Volunteer" title="후원자 목록" description="후원자를 관리합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<PermissionLink permission="donor.create" href="/donation-volunteer/donors/new" className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">후원자 등록</PermissionLink>}
      />
      <DataTable title="후원자" description="후원자 목록입니다." columns={columns} rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => router.push(`/donation-volunteer/donors/${String(row.id)}`)}
        getRowAriaLabel={(row) => `${String(row.donorNo)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "후원자 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 후원자가 없습니다" }}
      />
    </>
  );
}
