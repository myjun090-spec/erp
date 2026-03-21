"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";

const STATUS_LABELS: Record<string, string> = {
  planned: "계획", "in-progress": "진행중", "on-hold": "보류", completed: "완료",
};
const statusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planned: "default", "in-progress": "info", "on-hold": "warning", completed: "success",
};

type Milestone = { name: string; plannedDate: string; actualDate: string | null; status: string };
type OrderDoc = {
  _id: string; orderNo: string; status: string; quantity: number;
  plannedStartDate: string; plannedEndDate: string;
  projectSnapshot: { name: string; code: string } | null;
  moduleSnapshot: { moduleNo: string; moduleType: string; serialNo: string } | null;
  vendorSnapshot: { name: string; code: string } | null;
  milestones?: Milestone[];
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manufacturing-orders/${orderId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleComplete = async () => {
    const res = await fetch("/api/manufacturing/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete-order", targetIds: [orderId] }),
    });
    const json = await res.json();
    if (json.ok) {
      pushToast({ title: "완료 처리", description: "제작지시가 완료 처리되었습니다.", tone: "success" });
      router.push("/manufacturing/orders");
    } else {
      pushToast({ title: "오류", description: json.message, tone: "warning" });
    }
  };

  if (loading) return <StatePanel variant="loading" title="제작지시 로딩 중" description="제작지시 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/manufacturing/orders" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const canUpdateOrder = canAccessAction(viewerPermissions, "manufacturing-order.update");

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title={doc.orderNo} description={doc.moduleSnapshot?.moduleNo ?? ""}
        meta={[{ label: "Database", tone: "success" }, { label: STATUS_LABELS[doc.status] ?? doc.status, tone: statusTone[doc.status] ?? "default" }]}
        actions={<>
          <Link href="/manufacturing/orders" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canUpdateOrder ? (
            <PermissionLink permission="manufacturing-order.update" href={`/manufacturing/orders/${orderId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {doc.status === "in-progress" && (
            <PermissionButton permission="manufacturing-order.update" onClick={handleComplete} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">
              완료 처리
            </PermissionButton>
          )}
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">제작지시 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="지시번호" value={<span className="font-mono">{doc.orderNo}</span>} />
            <DetailField label="상태" value={<StatusBadge label={STATUS_LABELS[doc.status] ?? doc.status} tone={statusTone[doc.status] ?? "default"} />} />
            <DetailField label="계획 시작일" value={doc.plannedStartDate ?? "-"} />
            <DetailField label="계획 종료일" value={doc.plannedEndDate ?? "-"} />
            <DetailField label="수량" value={String(doc.quantity ?? 1)} />
          </dl>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">연결 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="대상 모듈" value={doc.moduleSnapshot ? `${doc.moduleSnapshot.moduleNo} (${doc.moduleSnapshot.moduleType})` : "-"} />
            <DetailField label="S/N" value={doc.moduleSnapshot?.serialNo ?? "-"} />
            <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.name} (${doc.projectSnapshot.code})` : "-"} />
            <DetailField label="제작사" value={doc.vendorSnapshot?.name ?? "-"} />
          </dl>
        </Panel>

        {doc.milestones && doc.milestones.length > 0 && (
          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">마일스톤</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                  <tr>
                    {["마일스톤", "계획일", "실적일", "상태"].map(h => (
                      <th key={h} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold tracking-[0.12em] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.milestones.map((m, i) => (
                    <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                      <td className="px-4 py-2 font-medium">{m.name}</td>
                      <td className="px-4 py-2">{m.plannedDate ?? "-"}</td>
                      <td className="px-4 py-2">{m.actualDate ?? "-"}</td>
                      <td className="px-4 py-2"><StatusBadge label={m.status} tone={m.status === "done" ? "success" : "default"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
