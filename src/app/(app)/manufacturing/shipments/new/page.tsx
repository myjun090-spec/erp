"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type ModuleOption = {
  _id: string; moduleNo: string; moduleType: string; serialNo: string;
  projectSnapshot: { projectId: string; code: string; name: string; projectType: string } | null;
  manufacturerSnapshot: { partyId?: string; code: string; name: string } | null;
};

const CUSTOMS_STATUS_OPTIONS = [
  { label: "해당없음", value: "n/a" },
  { label: "통관중", value: "pending" },
  { label: "통관완료", value: "cleared" },
];

export default function ShipmentNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [form, setForm] = useState({
    moduleId: "",
    origin: "",
    destination: "",
    departureDate: "",
    arrivalDate: "",
    customsStatus: "n/a",
  });

  const update = (key: string) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/modules");
        const json = await res.json();
        if (json.ok) setModules(
          json.data.items
            .filter((m: ModuleOption & { status: string }) => m.status === "shipped")
            .map((m: ModuleOption & { status: string }) => ({
              _id: m._id, moduleNo: m.moduleNo, moduleType: m.moduleType,
              serialNo: m.serialNo, projectSnapshot: m.projectSnapshot,
              manufacturerSnapshot: m.manufacturerSnapshot,
            }))
        );
      } catch {
        pushToast({ title: "오류", description: "모듈 목록을 불러오지 못했습니다.", tone: "warning" });
      } finally {
        setLoading(false);
      }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModule = modules.find(m => m._id === form.moduleId);

  const handleSubmit = async () => {
    if (!form.moduleId) {
      pushToast({ title: "필수 입력", description: "대상 모듈을 선택해 주세요.", tone: "warning" });
      return;
    }
    if (!form.origin || !form.destination) {
      pushToast({ title: "필수 입력", description: "출발지와 도착지를 입력해 주세요.", tone: "warning" });
      return;
    }

    const payload = {
      moduleSnapshots: selectedModule ? [{
        moduleId: selectedModule._id,
        moduleNo: selectedModule.moduleNo,
        moduleType: selectedModule.moduleType,
        serialNo: selectedModule.serialNo,
      }] : [],
      projectSnapshot: selectedModule?.projectSnapshot ?? null,
      origin: form.origin,
      destination: form.destination,
      departureDate: form.departureDate || null,
      arrivalDate: form.arrivalDate || null,
      logisticsStatus: "preparing",
      customsStatus: form.customsStatus,
      status: "planned",
    };

    setSaving(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "운송이 등록되었습니다.", tone: "success" });
        router.push("/manufacturing/shipments");
      } else {
        pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="데이터 로딩 중" description="모듈 목록을 불러오고 있습니다." />;

  return (
    <>
      <PageHeader eyebrow="Manufacturing" title="운송 등록" description="새로운 운송을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<>
          <Link href="/manufacturing/shipments" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
          <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">대상 모듈</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="모듈 선택"
              required
              type="select"
              value={form.moduleId}
              onChange={update("moduleId")}
              options={modules.map(m => ({ label: `${m.moduleNo} (${m.moduleType})`, value: m._id }))}
            />
            <FormField label="프로젝트" type="readonly" value={selectedModule?.projectSnapshot?.name ?? "-"} />
          </div>
          {modules.length === 0 && (
            <p className="mt-3 text-xs text-[color:var(--text-muted)]">출하(shipped) 상태의 모듈이 없습니다.</p>
          )}
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">운송 정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="출발지" required value={form.origin} onChange={update("origin")} placeholder="예: 경남 창원시" />
            <FormField label="도착지" required value={form.destination} onChange={update("destination")} placeholder="예: 경북 울진 현장" />
            <DatePicker label="출발일" value={form.departureDate} onChange={update("departureDate")} />
            <DatePicker label="도착예정일" value={form.arrivalDate} onChange={update("arrivalDate")} />
            <FormField label="통관상태" type="select" value={form.customsStatus} onChange={update("customsStatus")} options={CUSTOMS_STATUS_OPTIONS} />
          </div>
        </Panel>
      </div>
    </>
  );
}
