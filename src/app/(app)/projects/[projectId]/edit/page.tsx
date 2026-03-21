"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";
import { DatePicker } from "@/components/ui/date-picker";

type PartyOption = { _id: string; code: string; name: string };

export default function ProjectEditPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    projectType: "",
    customerPartyId: "",
    startDate: "",
    endDate: "",
    currency: "KRW",
  });

  useEffect(() => {
    async function load() {
      try {
        const [partiesRes, projectRes] = await Promise.all([
          fetch("/api/parties"),
          fetch(`/api/projects/${projectId}`),
        ]);
        const [partiesJson, projectJson] = await Promise.all([partiesRes.json(), projectRes.json()]);

        if (!partiesJson.ok) {
          setError(partiesJson.message || "고객 목록을 불러오지 못했습니다.");
          return;
        }
        if (!projectJson.ok) {
          setError(projectJson.message || "프로젝트를 불러오지 못했습니다.");
          return;
        }

        setParties(partiesJson.data.items.map((item: PartyOption) => ({ _id: item._id, code: item.code, name: item.name })));

        const doc = projectJson.data;
        setForm({
          code: doc.code || "",
          name: doc.name || "",
          projectType: doc.projectType || "",
          customerPartyId: doc.customerSnapshot?.partyId || "",
          startDate: doc.startDate || "",
          endDate: doc.endDate || "",
          currency: doc.currency || "KRW",
        });
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [projectId]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.projectType) {
      pushToast({ title: "필수 입력", description: "프로젝트 명칭과 유형을 확인해 주세요.", tone: "warning" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        pushToast({ title: "수정 완료", description: "프로젝트가 업데이트되었습니다.", tone: "success" });
        router.push(`/projects/${projectId}`);
        return;
      }
      pushToast({ title: "수정 실패", description: json.message || "프로젝트를 수정하지 못했습니다.", tone: "warning" });
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류가 발생했습니다.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="프로젝트 로딩 중" description="수정할 프로젝트를 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="프로젝트 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="프로젝트 수정"
        description="프로젝트 기본정보와 고객 연결 정보를 수정합니다."
        meta={[{ label: "Database", tone: "success" }]}
        actions={
          <>
            <Link href={`/projects/${projectId}`} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
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
            <FormField label="프로젝트코드" type="readonly" value={form.code} />
            <FormField label="프로젝트명" required value={form.name} onChange={update("name")} placeholder="SMR Alpha Unit 1" />
            <FormField
              label="프로젝트유형"
              required
              type="select"
              value={form.projectType}
              onChange={update("projectType")}
              options={[
                { label: "EPC", value: "EPC" },
                { label: "설계", value: "Design" },
                { label: "시공", value: "Construction" },
              ]}
            />
            <FormField
              label="고객"
              type="select"
              value={form.customerPartyId}
              onChange={update("customerPartyId")}
              options={parties.map((item) => ({ label: `${item.name} (${item.code})`, value: item._id }))}
            />
          </div>
        </Panel>
        <Panel className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">일정/통화</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <DatePicker label="시작일" value={form.startDate} onChange={update("startDate")} />
            <DatePicker label="종료일" value={form.endDate} onChange={update("endDate")} />
            <FormField
              label="통화"
              type="select"
              value={form.currency}
              onChange={update("currency")}
              options={[
                { label: "KRW", value: "KRW" },
                { label: "USD", value: "USD" },
              ]}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
