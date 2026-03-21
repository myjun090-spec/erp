"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type PartyOption = { _id: string; code: string; name: string };

export default function OpportunityNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  const update = (key: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateExpectedAmount = (value: string) => {
    setForm((prev) => ({
      ...prev,
      expectedAmount: formatIntegerInput(value),
    }));
  };

  const fetchParties = useCallback(async () => {
    try {
      const res = await fetch("/api/parties");
      const json = await res.json();
      if (json.ok) setParties(json.data.items.map((p: PartyOption) => ({ _id: p._id, code: p.code, name: p.name })));
    } catch { /* fallback */ }
  }, []);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  const handleSubmit = async () => {
    if (!form.name || !form.customerPartyId) {
      pushToast({ title: "필수 항목", description: "기회명과 고객을 입력해 주세요.", tone: "warning" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        expectedAmount: parseFormattedInteger(form.expectedAmount),
      };
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "등록 완료", description: "사업기회가 등록되었습니다.", tone: "success" });
        router.push("/business-development/opportunities");
      } else {
        pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
      }
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="사업기회 등록"
        description="새로운 사업기회를 등록합니다. 필수 항목을 입력한 후 저장하세요."
        actions={
          <>
            <Link href="/business-development/opportunities" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
              취소
            </Link>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "저장 중..." : "저장"}
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
              options={parties.map((p) => ({ label: `${p.name} (${p.code})`, value: p._id }))}
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
            <DatePicker label="예상수주일" required value={form.expectedAwardDate} onChange={update("expectedAwardDate")} />
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
