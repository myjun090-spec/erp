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

const STATUS_OPTIONS = [
  { label: "진행중", value: "in-progress" },
  { label: "보류", value: "on-hold" },
  { label: "완료", value: "completed" },
];

export default function OrderEditPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState("");
  const [moduleNo, setModuleNo] = useState("");
  const [form, setForm] = useState({
    plannedStartDate: "",
    plannedEndDate: "",
    status: "in-progress",
    quantity: "1",
  });

  const update = (key: string) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/manufacturing-orders/${orderId}`);
        const json = await res.json();
        if (!json.ok) { setError(json.message || "제작지시를 불러오지 못했습니다."); return; }
        const doc = json.data;
        setOrderNo(doc.orderNo ?? "");
        setModuleNo(doc.moduleSnapshot?.moduleNo ?? "");
        setForm({
          plannedStartDate: doc.plannedStartDate ?? "",
          plannedEndDate: doc.plannedEndDate ?? "",
          status: doc.status ?? "in-progress",
          quantity: String(doc.quantity ?? 1),
        });
      } catch { setError("네트워크 오류가 발생했습니다."); }
      finally { setLoading(false); }
    }
    void load();
  }, [orderId]);

  const handleSubmit = async () => {
    if (!form.plannedStartDate || !form.plannedEndDate) {
      pushToast({ title: "필수 입력", description: "계획 시작일과 종료일을 입력해 주세요.", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/manufacturing-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: form.plannedStartDate,
          plannedEndDate: form.plannedEndDate,
          status: form.status,
          quantity: Number(form.quantity) || 1,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "제작지시가 업데이트되었습니다.", tone: "success" });
        router.push(`/manufacturing/orders/${orderId}`);
      } else {
        pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="제작지시 로딩 중" description="제작지시 정보를 불러오고 있습니다." />;
  if (error) return <StatePanel variant="error" title="조회 실패" description={error} />;

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="제작지시 수정" description={orderNo}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href={`/manufacturing/orders/${orderId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">제작지시 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="지시번호" type="readonly" value={orderNo} />
            <FormField label="대상 모듈" type="readonly" value={moduleNo} />
            <FormField label="수량" type="number" value={form.quantity} onChange={update("quantity")} />
            <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">일정</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DatePicker label="계획 시작일" required value={form.plannedStartDate} onChange={update("plannedStartDate")} />
            <DatePicker label="계획 종료일" required value={form.plannedEndDate} onChange={update("plannedEndDate")} />
          </div>
        </Panel>
      </div>
    </>
  );
}
