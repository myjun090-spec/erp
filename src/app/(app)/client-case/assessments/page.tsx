"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

type AssessmentItem = {
  _id: string;
  assessmentNo: string;
  clientSnapshot: { name: string } | null;
  assessmentDate: string;
  assessmentType: string;
  overallScore: number;
  status: string;
};

const columns = [
  { key: "assessmentNo", label: "사정번호" },
  { key: "clientName", label: "이용자" },
  { key: "assessmentDate", label: "사정일" },
  { key: "assessmentType", label: "사정유형" },
  { key: "overallScore", label: "종합점수" },
  { key: "status", label: "상태" },
];

const statusToneMap: Record<string, "success" | "default" | "warning"> = {
  completed: "success",
  draft: "default",
  archived: "warning",
};

export default function AssessmentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/needs-assessments");
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "욕구사정 목록을 불러오지 못했습니다.");
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
    assessmentNo: <span className="font-mono text-[color:var(--primary)]">{item.assessmentNo}</span>,
    clientName: <span className="font-medium">{item.clientSnapshot?.name || "-"}</span>,
    assessmentDate: item.assessmentDate || "-",
    assessmentType: item.assessmentType || "-",
    overallScore: String(item.overallScore ?? "-"),
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
        eyebrow="욕구사정"
        title="욕구사정 목록"
        description="이용자 욕구사정 기록을 관리합니다."
        actions={
          <PermissionLink
            permission="needs-assessment.create"
            href="/client-case/assessments/new"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            욕구사정 등록
          </PermissionLink>
        }
      />
      <DataTable
        title="욕구사정"
        description="욕구사정 기록입니다."
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        onRowClick={(row) => {
          router.push(`/client-case/assessments/${String(row.id)}`);
        }}
        getRowAriaLabel={(row) => `${String(row.id)} 상세 보기`}
        loading={loading}
        errorState={error ? { title: "욕구사정 조회 실패", description: error } : null}
        emptyState={{ title: "등록된 욕구사정이 없습니다" }}
      />
    </>
  );
}
