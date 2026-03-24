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

const assessmentTypeOptions = [
  { label: "초기", value: "초기" },
  { label: "재사정", value: "재사정" },
  { label: "긴급", value: "긴급" },
];

const priorityOptions = [
  { label: "상", value: "상" },
  { label: "중", value: "중" },
  { label: "하", value: "하" },
];

const defaultDomains = [
  "건강",
  "일상생활",
  "사회관계",
  "경제",
  "가족",
  "주거환경",
];

type DomainForm = {
  domainName: string;
  currentStatus: string;
  score: string;
  needs: string;
  priority: string;
};

export default function AssessmentNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    assessmentDate: "",
    assessmentType: "초기",
    specialNotes: "",
  });
  const [domains, setDomains] = useState<DomainForm[]>(
    defaultDomains.map((name) => ({
      domainName: name,
      currentStatus: "",
      score: "3",
      needs: "",
      priority: "중",
    })),
  );

  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const json = await res.json();
        if (json.ok) {
          setClients(json.data.items);
        }
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

  const updateDomain = (index: number, key: keyof DomainForm, value: string) => {
    setDomains((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const scoreOptions = [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
  ];

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
      const res = await fetch("/api/needs-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSnapshot: {
            clientId: selectedClient._id,
            name: selectedClient.name,
            clientNo: selectedClient.clientNo,
          },
          assessmentDate: form.assessmentDate,
          assessmentType: form.assessmentType,
          specialNotes: form.specialNotes.trim(),
          domains: domains.map((d) => ({
            domainName: d.domainName,
            currentStatus: d.currentStatus.trim(),
            score: parseInt(d.score, 10),
            needs: d.needs.trim(),
            priority: d.priority,
          })),
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "욕구사정을 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "욕구사정이 등록되었습니다.",
        tone: "success",
      });
      router.push("/client-case/assessments");
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
        eyebrow="욕구사정"
        title="욕구사정 등록"
        description="새로운 욕구사정을 등록합니다."
        actions={
          <>
            <Link
              href="/client-case/assessments"
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="이용자"
            required
            type="select"
            value={form.clientId}
            onChange={update("clientId")}
            options={clientOptions}
          />
          <FormField
            label="사정일"
            type="date"
            value={form.assessmentDate}
            onChange={update("assessmentDate")}
          />
          <FormField
            label="사정유형"
            type="select"
            value={form.assessmentType}
            onChange={update("assessmentType")}
            options={assessmentTypeOptions}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">영역별 사정</h3>
        <div className="space-y-4">
          {domains.map((domain, index) => (
            <div key={domain.domainName} className="rounded-xl border border-[color:var(--border)] p-4">
              <div className="mb-3 text-sm font-semibold text-[color:var(--text)]">
                {domain.domainName}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  label="현재상태"
                  value={domain.currentStatus}
                  onChange={(v) => updateDomain(index, "currentStatus", v)}
                  placeholder="현재 상태 기술"
                />
                <FormField
                  label="점수 (1-5)"
                  type="select"
                  value={domain.score}
                  onChange={(v) => updateDomain(index, "score", v)}
                  options={scoreOptions}
                />
                <FormField
                  label="욕구"
                  value={domain.needs}
                  onChange={(v) => updateDomain(index, "needs", v)}
                  placeholder="파악된 욕구"
                />
                <FormField
                  label="우선순위"
                  type="select"
                  value={domain.priority}
                  onChange={(v) => updateDomain(index, "priority", v)}
                  options={priorityOptions}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <FormField
          label="특이사항"
          type="textarea"
          value={form.specialNotes}
          onChange={update("specialNotes")}
          placeholder="특이사항을 입력합니다."
          rows={4}
        />
      </Panel>
    </>
  );
}
