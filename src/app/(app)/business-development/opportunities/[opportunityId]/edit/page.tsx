"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { DatePicker } from "@/components/ui/date-picker";

type PartyOption = { _id: string; code: string; name: string };

export default function OpportunityEditPage() {
  const router = useRouter();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [form, setForm] = useState({
    name: "",
    customerPartyId: "",
    opportunityType: "",
    stage: "lead",
    expectedAmount: "",
    currency: "KRW",
    expectedAwardDate: "",
    riskSummary: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [partiesRes, opportunityRes] = await Promise.all([
          fetch("/api/parties"),
          fetch(`/api/opportunities/${opportunityId}`),
        ]);
        const [partiesJson, opportunityJson] = await Promise.all([partiesRes.json(), opportunityRes.json()]);

        if (!partiesJson.ok) {
          setError(partiesJson.message || "고객 목록을 불러오지 못했습니다.");
          return;
        }

        if (!opportunityJson.ok) {
          setError(opportunityJson.message || "사업기회를 불러오지 못했습니다.");
          return;
        }

        setParties(partiesJson.data.items.map((item: PartyOption) => ({ _id: item._id, code: item.code, name: item.name })));

        const doc = opportunityJson.data;
        setForm({
          name: doc.name || "",
          customerPartyId: doc.customerSnapshot?.partyId || "",
          opportunityType: doc.opportunityType || "",
          stage: doc.stage || "lead",
          expectedAmount: formatIntegerInput(doc.expectedAmount),
          currency: doc.currency || "KRW",
          expectedAwardDate: doc.expectedAwardDate || "",
          riskSummary: doc.riskSummary || "",
        });
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [opportunityId]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateExpectedAmount = (value: string) => {
    setForm((prev) => ({
      ...prev,
      expectedAmount: formatIntegerInput(value),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.customerPartyId || !form.opportunityType) {
      pushToast({ title: "필수 항목", description: "기회명, 고객, 기회유형을 확인해 주세요.", tone: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expectedAmount: parseFormattedInteger(form.expectedAmount),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "사업기회가 업데이트되었습니다.", tone: "success" });
        router.push(`/business-development/opportunities/${opportunityId}`);
        return;
      }
      pushToast({ title: "수정 실패", description: json.message || "사업기회를 수정하지 못했습니다.", tone: "warning" });
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="사업기회 로딩 중" description="수정할 사업기회를 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="사업기회 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="사업기회 수정"
        description="사업기회 단계, 고객, 예상금액과 리스크 요약을 수정합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href={`/business-development/opportunities/${opportunityId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              취소
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본정보</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="기회명" required value={form.name} onChange={update("name")} placeholder="사업기회 명칭" className="md:col-span-2" />
            <FormField
              label="고객"
              required
              type="select"
              value={form.customerPartyId}
              onChange={update("customerPartyId")}
              options={parties.map((item) => ({ label: `${item.name} (${item.code})`, value: item._id }))}
            />
            <FormField
              label="기회유형"
              required
              type="select"
              value={form.opportunityType}
              onChange={update("opportunityType")}
              options={[
                { label: "EPC", value: "epc" },
                { label: "턴키", value: "turnkey" },
                { label: "설계", value: "design" },
                { label: "용역", value: "service" },
              ]}
            />
            <FormField
              label="단계"
              required
              type="select"
              value={form.stage}
              onChange={update("stage")}
              options={[
                { label: "Lead", value: "lead" },
                { label: "Qualified", value: "qualified" },
                { label: "Proposal", value: "proposal" },
                { label: "Negotiation", value: "negotiation" },
              ]}
            />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">금액/일정</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="예상금액"
              required
              type="text"
              inputMode="numeric"
              value={form.expectedAmount}
              onChange={updateExpectedAmount}
              placeholder="0"
            />
            <FormField
              label="통화"
              type="select"
              value={form.currency}
              onChange={update("currency")}
              options={[
                { label: "KRW", value: "KRW" },
                { label: "USD", value: "USD" },
                { label: "EUR", value: "EUR" },
              ]}
            />
            <DatePicker label="예상수주일" value={form.expectedAwardDate} onChange={update("expectedAwardDate")} />
          </div>
        </Panel>
        <Panel className="p-5 xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">리스크/메모</h3>
          <FormField label="주요 리스크" type="textarea" value={form.riskSummary} onChange={update("riskSummary")} placeholder="주요 리스크 사항을 기록하세요" rows={4} />
        </Panel>
      </div>
    </>
  );
}
