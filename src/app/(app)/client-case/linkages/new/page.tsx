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

const linkageTypeOptions = [
  { label: "내부", value: "internal" },
  { label: "외부", value: "external" },
];

const serviceCategoryOptions = [
  { label: "의료", value: "의료" },
  { label: "심리상담", value: "심리상담" },
  { label: "법률", value: "법률" },
  { label: "주거", value: "주거" },
  { label: "취업", value: "취업" },
  { label: "교육", value: "교육" },
  { label: "돌봄", value: "돌봄" },
];

export default function LinkageNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    linkageType: "external",
    serviceCategory: "",
    referralOrg: "",
    referralContact: "",
    referralDate: "",
    resultDescription: "",
  });

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
      const res = await fetch("/api/service-linkages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSnapshot: {
            clientId: selectedClient._id,
            name: selectedClient.name,
            clientNo: selectedClient.clientNo,
          },
          linkageType: form.linkageType,
          serviceCategory: form.serviceCategory,
          referralOrg: form.referralOrg.trim(),
          referralContact: form.referralContact.trim(),
          referralDate: form.referralDate,
          resultDescription: form.resultDescription.trim(),
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "서비스연계를 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "서비스연계가 등록되었습니다.",
        tone: "success",
      });
      router.push("/client-case/linkages");
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
        eyebrow="서비스연계"
        title="서비스연계 등록"
        description="새로운 서비스연계를 등록합니다."
        actions={
          <>
            <Link
              href="/client-case/linkages"
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
            label="연계유형"
            type="select"
            value={form.linkageType}
            onChange={update("linkageType")}
            options={linkageTypeOptions}
          />
          <FormField
            label="서비스분류"
            type="select"
            value={form.serviceCategory}
            onChange={update("serviceCategory")}
            options={serviceCategoryOptions}
          />
          <FormField
            label="연계기관"
            value={form.referralOrg}
            onChange={update("referralOrg")}
            placeholder="연계기관명"
          />
          <FormField
            label="연계기관 연락처"
            value={form.referralContact}
            onChange={update("referralContact")}
            placeholder="연락처"
          />
          <FormField
            label="연계일"
            type="date"
            value={form.referralDate}
            onChange={update("referralDate")}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <FormField
              label="결과 설명"
              type="textarea"
              value={form.resultDescription}
              onChange={update("resultDescription")}
              placeholder="연계 결과를 기술합니다."
              rows={4}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}
