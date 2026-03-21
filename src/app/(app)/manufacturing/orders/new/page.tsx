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

type ModuleOption = { _id: string; moduleNo: string; moduleType: string; serialNo: string; status: string; projectSnapshot: { projectId: string; code: string; name: string; projectType: string } | null };
type VendorOption = { _id: string; code: string; name: string };

const STATUS_OPTIONS = [
  { label: "계획", value: "planned" },
  { label: "진행중", value: "in-progress" },
  { label: "보류", value: "on-hold" },
  { label: "완료", value: "completed" },
];

export default function ManufacturingOrderNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [form, setForm] = useState({
    moduleId: "",
    vendorId: "",
    plannedStartDate: "",
    plannedEndDate: "",
    quantity: "1",
    status: "planned",
  });

  const update = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      try {
        const [modulesRes, vendorsRes] = await Promise.all([
          fetch("/api/modules"),
          fetch("/api/vendors"),
        ]);
        const [modulesJson, vendorsJson] = await Promise.all([
          modulesRes.json(),
          vendorsRes.json(),
        ]);
        if (modulesJson.ok) setModules(
          modulesJson.data.items
            .filter((m: ModuleOption) => m.status === "planned")
            .map((m: ModuleOption) => ({ _id: m._id, moduleNo: m.moduleNo, moduleType: m.moduleType, serialNo: m.serialNo, status: m.status, projectSnapshot: m.projectSnapshot }))
        );
        if (vendorsJson.ok) setVendors(vendorsJson.data.items.map((v: VendorOption) => ({ _id: v._id, code: v.code, name: v.name })));
      } catch {
        pushToast({ title: "오류", description: "목록을 불러오지 못했습니다.", tone: "warning" });
      } finally {
        setLoading(false);
      }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModule = modules.find((m) => m._id === form.moduleId);

  const handleSubmit = async () => {
    if (!form.moduleId) {
      pushToast({ title: "필수 입력", description: "대상 모듈을 선택해 주세요.", tone: "warning" });
      return;
    }
    if (!form.vendorId) {
      pushToast({ title: "필수 입력", description: "제작사를 선택해 주세요.", tone: "warning" });
      return;
    }
    if (!form.plannedStartDate || !form.plannedEndDate) {
      pushToast({ title: "필수 입력", description: "계획 시작일과 종료일을 입력해 주세요.", tone: "warning" });
      return;
    }

    const selectedVendor = vendors.find((v) => v._id === form.vendorId);

    const payload = {
      moduleSnapshot: selectedModule ? {
        moduleId: selectedModule._id,
        moduleNo: selectedModule.moduleNo,
        moduleType: selectedModule.moduleType,
        serialNo: selectedModule.serialNo,
      } : null,
      projectSnapshot: selectedModule?.projectSnapshot ?? null,
      vendorSnapshot: selectedVendor ? {
        partyId: selectedVendor._id,
        code: selectedVendor.code,
        name: selectedVendor.name,
      } : null,
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      quantity: Number(form.quantity) || 1,
      status: form.status,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/manufacturing-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "제작지시가 등록되었습니다.", tone: "success" });
        router.push("/manufacturing/orders");
      } else {
        pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="데이터 로딩 중" description="모듈 및 제작사 목록을 불러오고 있습니다." />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Manufacturing"
        title="제작지시 등록"
        description="새로운 제작지시를 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href="/manufacturing/orders" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link>
            <button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">제작 대상</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="대상 모듈"
              required
              type="select"
              value={form.moduleId}
              onChange={update("moduleId")}
              options={modules.map((m) => ({ label: `${m.moduleNo} (${m.moduleType})`, value: m._id }))}
            />
            <FormField
              label="프로젝트"
              type="readonly"
              value={selectedModule?.projectSnapshot?.name ?? "-"}
            />
            <FormField
              label="제작사"
              required
              type="select"
              value={form.vendorId}
              onChange={update("vendorId")}
              options={vendors.map((v) => ({ label: `${v.name} (${v.code})`, value: v._id }))}
            />
            <FormField
              label="수량"
              type="number"
              value={form.quantity}
              onChange={update("quantity")}
              placeholder="1"
            />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">일정 및 상태</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DatePicker label="계획 시작일" required value={form.plannedStartDate} onChange={update("plannedStartDate")} />
            <DatePicker label="계획 종료일" required value={form.plannedEndDate} onChange={update("plannedEndDate")} />
            <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
          </div>
        </Panel>
      </div>
    </>
  );
}
