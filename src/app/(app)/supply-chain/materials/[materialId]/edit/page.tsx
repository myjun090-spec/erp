"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

const UOM_OPTIONS = [
  { label: "EA", value: "EA" },
  { label: "SET", value: "SET" },
  { label: "KG", value: "KG" },
  { label: "M", value: "M" },
  { label: "LOT", value: "LOT" },
];

const CATEGORY_OPTIONS = [
  { label: "기계", value: "mechanical" },
  { label: "전기", value: "electrical" },
  { label: "배관", value: "piping" },
  { label: "계장", value: "instrument" },
];

const STATUS_OPTIONS = [
  { label: "활성", value: "active" },
  { label: "비활성", value: "inactive" },
  { label: "보관", value: "archived" },
];

type MaterialDetail = {
  _id: string;
  materialCode: string;
  description: string;
  specification?: string;
  uom: string;
  manufacturerName?: string;
  category?: string;
  status: string;
};

export default function MaterialEditPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    materialCode: "",
    description: "",
    specification: "",
    uom: "",
    manufacturerName: "",
    category: "",
    status: "active",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/materials/${materialId}`);
        const json = await res.json();

        if (!json.ok) {
          setError(json.message || "자재를 불러오지 못했습니다.");
          return;
        }

        const doc = json.data as MaterialDetail;
        setForm({
          materialCode: doc.materialCode || "",
          description: doc.description || "",
          specification: doc.specification || "",
          uom: doc.uom || "",
          manufacturerName: doc.manufacturerName || "",
          category: doc.category || "",
          status: doc.status || "active",
        });
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [materialId]);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.description || !form.uom) {
      pushToast({
        title: "필수 입력",
        description: "자재명과 단위는 필수입니다.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          specification: form.specification,
          uom: form.uom,
          manufacturerName: form.manufacturerName,
          category: form.category,
          status: form.status,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({ title: "수정 실패", description: json.message, tone: "warning" });
        return;
      }

      pushToast({ title: "수정 완료", description: "자재 정보가 업데이트되었습니다.", tone: "success" });
      router.push(`/supply-chain/materials/${materialId}`);
    } catch {
      pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <StatePanel variant="loading" title="자재 로딩 중" description="자재 정보를 불러오고 있습니다." />;
  }

  if (error) {
    return <StatePanel variant="error" title="자재 조회 실패" description={error} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title="자재 수정"
        description={form.materialCode}
        actions={
          <>
            <Link
              href={`/supply-chain/materials/${materialId}`}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="자재코드" type="readonly" value={form.materialCode} />
          <FormField label="자재명" required value={form.description} onChange={update("description")} placeholder="자재 명칭" />
          <FormField label="규격" value={form.specification} onChange={update("specification")} placeholder="규격 상세" />
          <FormField label="단위" required type="select" value={form.uom} onChange={update("uom")} options={UOM_OPTIONS} />
          <FormField label="제조사" value={form.manufacturerName} onChange={update("manufacturerName")} placeholder="제조사명" />
          <FormField label="분류" type="select" value={form.category} onChange={update("category")} options={CATEGORY_OPTIONS} />
          <FormField label="상태" type="select" value={form.status} onChange={update("status")} options={STATUS_OPTIONS} />
        </div>
      </Panel>
    </>
  );
}
