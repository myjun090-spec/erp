"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

const CUSTOMS_STATUS_OPTIONS = [
  { label: "해당없음", value: "n/a" },
  { label: "통관중", value: "pending" },
  { label: "통관완료", value: "cleared" },
];
const LOGISTICS_STATUS_OPTIONS = [
  { label: "계획", value: "planned" },
  { label: "예약됨", value: "booked" },
  { label: "준비중", value: "preparing" },
  { label: "운송중", value: "in-transit" },
  { label: "도착완료", value: "delivered" },
];

export default function ShipmentEditPage() {
  const { shipmentId } = useParams<{ shipmentId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shipmentNo, setShipmentNo] = useState("");
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departureDate: "",
    arrivalDate: "",
    logisticsStatus: "preparing",
    customsStatus: "n/a",
  });

  const update = (key: string) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shipments/${shipmentId}`);
        const json = await res.json();
        if (!json.ok) { setError(json.message || "운송을 불러오지 못했습니다."); return; }
        const doc = json.data;
        setShipmentNo(doc.shipmentNo ?? "");
        setForm({
          origin: doc.origin ?? "",
          destination: doc.destination ?? "",
          departureDate: doc.departureDate ?? "",
          arrivalDate: doc.arrivalDate ?? "",
          logisticsStatus: doc.logisticsStatus ?? "preparing",
          customsStatus: doc.customsStatus ?? "n/a",
        });
      } catch { setError("네트워크 오류가 발생했습니다."); }
      finally { setLoading(false); }
    }
    void load();
  }, [shipmentId]);

  const handleSubmit = async () => {
    if (!form.origin || !form.destination) {
      pushToast({ title: "필수 입력", description: "출발지와 도착지를 입력해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: form.origin,
          destination: form.destination,
          departureDate: form.departureDate || null,
          arrivalDate: form.arrivalDate || null,
          logisticsStatus: form.logisticsStatus,
          status: form.logisticsStatus,
          customsStatus: form.customsStatus,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "운송이 업데이트되었습니다.", tone: "success" });
        router.push(`/manufacturing/shipments/${shipmentId}`);
      } else {
        pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="운송 로딩 중" description="운송 정보를 불러오고 있습니다." />;
  if (error) return <StatePanel variant="error" title="조회 실패" description={error} />;

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="운송 수정" description={shipmentNo}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/manufacturing/shipments/${shipmentId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">운송 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="운송번호" type="readonly" value={shipmentNo} />
            <FormField label="운송상태" type="select" value={form.logisticsStatus} onChange={update("logisticsStatus")} options={LOGISTICS_STATUS_OPTIONS} />
            <FormField label="출발지" required value={form.origin} onChange={update("origin")} placeholder="예: 경남 창원시" />
            <FormField label="도착지" required value={form.destination} onChange={update("destination")} placeholder="예: 경북 울진 현장" />
            <DatePicker label="출발일" value={form.departureDate} onChange={update("departureDate")} />
            <DatePicker label="도착일" value={form.arrivalDate} onChange={update("arrivalDate")} />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">통관</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="통관상태" type="select" value={form.customsStatus} onChange={update("customsStatus")} options={CUSTOMS_STATUS_OPTIONS} />
          </div>
        </Panel>
      </div>
    </>
  );
}
