"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

const LOGISTICS_LABELS: Record<string, string> = {
  planned: "계획", booked: "예약됨", preparing: "준비중", "in-transit": "운송중", delivered: "도착완료",
};
const CUSTOMS_LABELS: Record<string, string> = {
  "n/a": "해당없음", pending: "통관중", cleared: "통관완료",
};
const logisticsTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planned: "default", booked: "default", preparing: "warning", "in-transit": "info", delivered: "success",
};
const customsTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  "n/a": "default", pending: "warning", cleared: "success",
};

type ShipmentDoc = {
  _id: string;
  shipmentNo: string;
  logisticsStatus: string;
  customsStatus: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string | null;
  arrivalDate: string | null;
  projectSnapshot: { name: string; code: string } | null;
  moduleSnapshots: { moduleNo: string; moduleType: string; serialNo: string }[] | null;
};

export default function ShipmentDetailPage() {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<ShipmentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    } catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [shipmentId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const runAction = async (action: string, label: string) => {
    const res = await fetch("/api/shipments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetIds: [shipmentId] }),
    });
    const json = await res.json();
    if (json.ok) {
      pushToast({ title: label, description: "처리되었습니다.", tone: "success" });
      fetchData();
    } else {
      pushToast({ title: "오류", description: json.message, tone: "warning" });
    }
  };

  if (loading) return <StatePanel variant="loading" title="운송 로딩 중" description="운송 정보를 불러오고 있습니다." />;
  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2>
      <Link href="/manufacturing/shipments" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link>
    </div>
  );

  const canUpdateShipment = canAccessAction(viewerPermissions, "shipment.update");

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title={doc.shipmentNo} description={doc.projectSnapshot?.name ?? ""}
        meta={[
          { label: "Database", tone: "success" },
          { label: LOGISTICS_LABELS[doc.logisticsStatus] ?? doc.logisticsStatus, tone: logisticsTone[doc.logisticsStatus] ?? "default" },
          { label: CUSTOMS_LABELS[doc.customsStatus] ?? doc.customsStatus, tone: customsTone[doc.customsStatus] ?? "default" },
        ]}
        actions={<>
          <Link href="/manufacturing/shipments" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
          {canUpdateShipment ? (
            <PermissionLink permission="shipment.update" href={`/manufacturing/shipments/${shipmentId}/edit`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">수정</PermissionLink>
          ) : null}
          {(doc.logisticsStatus === "preparing" || doc.logisticsStatus === "booked" || doc.logisticsStatus === "planned") && (
            <PermissionButton permission="shipment.approve" onClick={() => runAction("start-transit", "운송 시작")} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
              운송 시작
            </PermissionButton>
          )}
          {doc.customsStatus === "pending" && (
            <PermissionButton permission="shipment.approve" onClick={() => runAction("clear-customs", "통관 완료")} className="rounded-full bg-[color:var(--warning)] px-4 py-2 text-sm font-semibold text-white">
              통관 완료
            </PermissionButton>
          )}
          {doc.logisticsStatus === "in-transit" && (
            <PermissionButton permission="shipment.approve" onClick={() => runAction("complete-delivery", "도착 완료")} className="rounded-full bg-[color:var(--success)] px-4 py-2 text-sm font-semibold text-white">
              도착 완료
            </PermissionButton>
          )}
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">운송 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="운송번호" value={<span className="font-mono">{doc.shipmentNo}</span>} />
            <DetailField label="운송상태" value={<StatusBadge label={LOGISTICS_LABELS[doc.logisticsStatus] ?? doc.logisticsStatus} tone={logisticsTone[doc.logisticsStatus] ?? "default"} />} />
            <DetailField label="출발지" value={doc.origin ?? "-"} />
            <DetailField label="도착지" value={doc.destination ?? "-"} />
            <DetailField label="출발일" value={doc.departureDate ?? "-"} />
            <DetailField label="도착일" value={doc.arrivalDate ?? "-"} />
          </dl>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">연결 정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="프로젝트" value={doc.projectSnapshot ? `${doc.projectSnapshot.name} (${doc.projectSnapshot.code})` : "-"} />
            <DetailField label="통관상태" value={<StatusBadge label={CUSTOMS_LABELS[doc.customsStatus] ?? doc.customsStatus} tone={customsTone[doc.customsStatus] ?? "default"} />} />
          </dl>
        </Panel>

        {doc.moduleSnapshots && doc.moduleSnapshots.length > 0 && (
          <Panel className="p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">대상 모듈</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]">
                  <tr>
                    {["모듈번호", "유형", "S/N"].map(h => (
                      <th key={h} className="border-b border-[color:var(--border)] px-4 py-2 text-left text-xs font-semibold tracking-[0.12em] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.moduleSnapshots.map((m, i) => (
                    <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
                      <td className="px-4 py-2 font-mono font-medium">{m.moduleNo}</td>
                      <td className="px-4 py-2">{m.moduleType}</td>
                      <td className="px-4 py-2">{m.serialNo ?? "-"}</td>
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
