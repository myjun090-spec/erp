"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";

type ClientOption = {
  _id: string;
  clientNo: string;
  name: string;
};

type GoalForm = {
  goalTitle: string;
  targetDescription: string;
  intervention: string;
  frequency: string;
  responsiblePerson: string;
};

export default function PlanNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    planDate: "",
    startDate: "",
    endDate: "",
  });
  const [goals, setGoals] = useState<GoalForm[]>([
    { goalTitle: "", targetDescription: "", intervention: "", frequency: "", responsiblePerson: "" },
  ]);

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const json = await res.json();
        if (json.ok) setClients(json.data.items);
      } catch {
        setClients([]);
      }
    }
    void loadClients();
  }, []);

  const clientOptions = clients.map((c) => ({
    label: `${c.name} (${c.clientNo})`,
    value: c._id,
  }));

  const update =
    (key: keyof typeof form) =>
    (value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const updateGoal = (index: number, key: keyof GoalForm, value: string) => {
    setGoals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addGoal = () => {
    setGoals((prev) => [
      ...prev,
      { goalTitle: "", targetDescription: "", intervention: "", frequency: "", responsiblePerson: "" },
    ]);
  };

  const removeGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.clientId) {
      pushToast({
        title: "필수 입력",
        description: "이용자를 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    const selectedClient = clients.find((c) => c._id === form.clientId);
    if (!selectedClient) {
      pushToast({
        title: "이용자 오류",
        description: "선택한 이용자를 찾을 수 없습니다.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/case-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSnapshot: {
            clientId: selectedClient._id,
            name: selectedClient.name,
            clientNo: selectedClient.clientNo,
          },
          planDate: form.planDate,
          startDate: form.startDate,
          endDate: form.endDate,
          goals: goals.map((g) => ({
            goalTitle: g.goalTitle.trim(),
            targetDescription: g.targetDescription.trim(),
            intervention: g.intervention.trim(),
            frequency: g.frequency.trim(),
            responsiblePerson: g.responsiblePerson.trim(),
          })),
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "사례계획을 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "사례계획이 등록되었습니다.",
        tone: "success",
      });
      router.push("/client-case/plans");
    } catch {
      pushToast({
        title: "등록 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="사례계획"
        title="사례계획 등록"
        description="새로운 사례계획을 등록합니다."
        actions={
          <>
            <Link
              href="/client-case/plans"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />

      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            label="이용자"
            required
            type="select"
            value={form.clientId}
            onChange={update("clientId")}
            options={clientOptions}
          />
          <FormField
            label="작성일"
            type="date"
            value={form.planDate}
            onChange={update("planDate")}
          />
          <FormField
            label="시작일"
            type="date"
            value={form.startDate}
            onChange={update("startDate")}
          />
          <FormField
            label="종료일"
            type="date"
            value={form.endDate}
            onChange={update("endDate")}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[color:var(--text)]">목표 및 개입계획</h3>
          <button
            type="button"
            onClick={addGoal}
            className="rounded-full border border-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]"
          >
            목표 추가
          </button>
        </div>
        <div className="space-y-4">
          {goals.map((goal, index) => (
            <div key={index} className="rounded-xl border border-[color:var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[color:var(--text)]">
                  목표 {index + 1}
                </span>
                {goals.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeGoal(index)}
                    className="text-xs font-semibold text-[color:var(--danger)]"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField
                  label="목표"
                  value={goal.goalTitle}
                  onChange={(v) => updateGoal(index, "goalTitle", v)}
                  placeholder="목표명"
                />
                <FormField
                  label="달성기준"
                  value={goal.targetDescription}
                  onChange={(v) => updateGoal(index, "targetDescription", v)}
                  placeholder="달성 기준 기술"
                />
                <FormField
                  label="개입방법"
                  value={goal.intervention}
                  onChange={(v) => updateGoal(index, "intervention", v)}
                  placeholder="개입 방법"
                />
                <FormField
                  label="빈도"
                  value={goal.frequency}
                  onChange={(v) => updateGoal(index, "frequency", v)}
                  placeholder="주 2회"
                />
                <FormField
                  label="담당"
                  value={goal.responsiblePerson}
                  onChange={(v) => updateGoal(index, "responsiblePerson", v)}
                  placeholder="담당자"
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
