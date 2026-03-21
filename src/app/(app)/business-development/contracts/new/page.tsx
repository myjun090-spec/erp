"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { generateContractNo } from "@/lib/document-numbers";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { DatePicker } from "@/components/ui/date-picker";

type PartyOption = { _id: string; code: string; name: string };
type ProjectOption = { _id: string; code: string; name: string };

export default function ContractNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    contractNo: generateContractNo(),
    title: "",
    contractType: "",
    customerPartyId: "",
    projectId: "",
    startDate: "",
    endDate: "",
    contractAmount: "",
    currency: "KRW",
  });
  const update = (key: string) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const updateContractAmount = (value: string) =>
    setForm((prev) => ({
      ...prev,
      contractAmount: formatIntegerInput(value),
    }));

  useEffect(() => {
    async function load() {
      try {
        const [partiesRes, projectsRes] = await Promise.all([
          fetch("/api/parties"),
          fetch("/api/projects"),
        ]);
        const [partiesJson, projectsJson] = await Promise.all([
          partiesRes.json(),
          projectsRes.json(),
        ]);

        if (!partiesJson.ok) {
          setError(partiesJson.message || "거래처 목록을 불러오지 못했습니다.");
          return;
        }
        if (!projectsJson.ok) {
          setError(projectsJson.message || "프로젝트 목록을 불러오지 못했습니다.");
          return;
        }

        setParties(partiesJson.data.items.map((item: PartyOption) => ({ _id: item._id, code: item.code, name: item.name })));
        setProjects(projectsJson.data.items.map((item: ProjectOption) => ({ _id: item._id, code: item.code, name: item.name })));
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.contractType || !form.customerPartyId) { pushToast({ title: "필수 입력", description: "계약명, 계약유형, 고객은 필수입니다.", tone: "warning" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, contractNo: form.contractNo || generateContractNo(), contractAmount: parseFormattedInteger(form.contractAmount) }) });
      const json = await res.json();
      if (json.ok) { pushToast({ title: "등록 완료", description: "계약이 등록되었습니다.", tone: "success" }); router.push("/business-development/contracts"); }
      else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); } finally { setSaving(false); }
  };

  if (loading) {
    return <StatePanel variant="loading" title="계약 입력 준비 중" description="거래처와 프로젝트 목록을 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="계약 등록 준비 실패" description={error} />;
  }

  return (
    <>
      <PageHeader eyebrow="Business Development" title="계약 등록" description="새로운 계약을 등록합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={<><Link href="/business-development/contracts" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link><button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button></>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">계약정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="계약번호" type="readonly" value={form.contractNo} />
            <FormField label="계약명" required value={form.title} onChange={update("title")} placeholder="계약 명칭" />
            <FormField label="계약유형" required type="select" value={form.contractType} onChange={update("contractType")} options={[{ label: "EPC", value: "epc" }, { label: "턴키", value: "turnkey" }, { label: "용역", value: "service" }]} />
            <FormField label="고객" required type="select" value={form.customerPartyId} onChange={update("customerPartyId")} options={parties.map((item) => ({ label: `${item.name} (${item.code})`, value: item._id }))} />
            <FormField label="프로젝트" type="select" value={form.projectId} onChange={update("projectId")} options={projects.map((item) => ({ label: `${item.name} (${item.code})`, value: item._id }))} />
          </div></Panel>
        <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">금액/기간</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="계약금액" required type="text" inputMode="numeric" value={form.contractAmount} onChange={updateContractAmount} placeholder="0" />
            <FormField label="통화" type="select" value={form.currency} onChange={update("currency")} options={[{ label: "KRW", value: "KRW" }, { label: "USD", value: "USD" }]} />
            <DatePicker label="시작일" required value={form.startDate} onChange={update("startDate")} />
            <DatePicker label="종료일" required value={form.endDate} onChange={update("endDate")} />
          </div></Panel>
      </div>
    </>
  );
}
