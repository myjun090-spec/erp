"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import {
  assetClassOptions,
  depreciationMethodOptions,
  getAssetClassLabel,
  getDepreciationMethodLabel,
} from "@/lib/fixed-assets";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type ProjectOption = {
  _id: string;
  code: string;
  name: string;
  status: string;
};

type AssetDoc = {
  _id: string;
  assetNo: string;
  assetClass: string;
  projectSnapshot?: { projectId?: string; code?: string; name?: string } | null;
  location?: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeMonths?: number;
  depreciationMethod: string;
  status: string;
  ledgerSummary?: { accumulatedDepreciation?: number; bookValue?: number } | null;
};

export default function AssetEditPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [doc, setDoc] = useState<AssetDoc | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    assetClass: "",
    location: "",
    acquisitionDate: "",
    acquisitionCost: "",
    usefulLifeMonths: "",
    depreciationMethod: "",
    status: "active",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [assetRes, optionsRes] = await Promise.all([
          fetch(`/api/assets/${assetId}`),
          fetch("/api/assets/options"),
        ]);
        const [assetJson, optionsJson] = await Promise.all([assetRes.json(), optionsRes.json()]);

        if (cancelled) {
          return;
        }

        if (!assetJson.ok) {
          pushToast({
            title: "조회 실패",
            description: assetJson.message || "자산을 불러오지 못했습니다.",
            tone: "warning",
          });
          router.push("/finance/assets");
          return;
        }

        const nextDoc = assetJson.data as AssetDoc;
        if (nextDoc.status === "archived") {
          pushToast({
            title: "수정 불가",
            description: "보관된 자산은 복원 후 수정할 수 있습니다.",
            tone: "warning",
          });
          router.push(`/finance/assets/${assetId}`);
          return;
        }
        setDoc(nextDoc);
        setProjects(optionsJson.ok ? optionsJson.data.projects ?? [] : []);
        setForm({
          projectId: nextDoc.projectSnapshot?.projectId || "",
          assetClass: nextDoc.assetClass || "",
          location: nextDoc.location || "",
          acquisitionDate: nextDoc.acquisitionDate || "",
          acquisitionCost: formatIntegerInput(nextDoc.acquisitionCost || 0),
          usefulLifeMonths: formatIntegerInput(nextDoc.usefulLifeMonths || 0),
          depreciationMethod: nextDoc.depreciationMethod || "straight-line",
          status: nextDoc.status || "active",
        });
      } catch {
        if (!cancelled) {
          pushToast({
            title: "조회 실패",
            description: "자산 정보를 불러오는 중 오류가 발생했습니다.",
            tone: "warning",
          });
          router.push("/finance/assets");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId, pushToast, router]);

  const update =
    (key: keyof typeof form) =>
    (value: string) => {
      setForm((prev) => ({
        ...prev,
        [key]:
          key === "acquisitionCost" || key === "usefulLifeMonths"
            ? formatIntegerInput(value)
            : value,
      }));
    };

  const handleSubmit = async () => {
    if (
      !doc ||
      !form.projectId ||
      !form.assetClass ||
      !form.acquisitionDate ||
      parseFormattedInteger(form.acquisitionCost) <= 0 ||
      parseFormattedInteger(form.usefulLifeMonths) <= 0
    ) {
      pushToast({
        title: "필수 입력",
        description: "프로젝트, 자산분류, 취득일, 취득가액, 내용연수를 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetNo: doc.assetNo,
          projectId: form.projectId,
          assetClass: form.assetClass,
          location: form.location.trim(),
          acquisitionDate: form.acquisitionDate,
          acquisitionCost: parseFormattedInteger(form.acquisitionCost),
          usefulLifeMonths: parseFormattedInteger(form.usefulLifeMonths),
          depreciationMethod: form.depreciationMethod,
          status: form.status,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "저장 실패",
          description: json.message || "자산을 수정하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "저장 완료",
        description: "자산이 업데이트되었습니다.",
        tone: "success",
      });
      router.push(`/finance/assets/${assetId}`);
    } catch {
      pushToast({
        title: "저장 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !doc) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">
        로딩 중...
      </div>
    );
  }

  const acquisitionCostLocked = Number(doc.ledgerSummary?.accumulatedDepreciation || 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={doc.assetNo}
        description={`${getAssetClassLabel(doc.assetClass)} · ${getDepreciationMethodLabel(doc.depreciationMethod)}`}
        actions={
          <>
            <Link
              href={`/finance/assets/${assetId}`}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={() => void handleSubmit()}
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
          <FormField label="자산번호" type="readonly" value={doc.assetNo} />
          <FormField
            label="프로젝트"
            required
            type="select"
            value={form.projectId}
            onChange={update("projectId")}
            options={projects.map((project) => ({
              value: project._id,
              label: `${project.code} · ${project.name}`,
            }))}
          />
          <FormField
            label="자산분류"
            required
            type="select"
            value={form.assetClass}
            onChange={update("assetClass")}
            options={[...assetClassOptions]}
          />
          <FormField label="설치장소" value={form.location} onChange={update("location")} placeholder="설치장소 또는 보관 위치" />
          <DatePicker label="취득일" required value={form.acquisitionDate} onChange={update("acquisitionDate")} />
          {acquisitionCostLocked ? (
            <FormField label="취득가액" type="readonly" value={form.acquisitionCost || "0"} />
          ) : (
            <FormField
              label="취득가액"
              required
              value={form.acquisitionCost}
              onChange={update("acquisitionCost")}
              inputMode="numeric"
              placeholder="0"
            />
          )}
          <FormField
            label="내용연수(월)"
            required
            value={form.usefulLifeMonths}
            onChange={update("usefulLifeMonths")}
            inputMode="numeric"
            placeholder="60"
          />
          <FormField
            label="감가상각 방법"
            required
            type="select"
            value={form.depreciationMethod}
            onChange={update("depreciationMethod")}
            options={[...depreciationMethodOptions]}
          />
          <FormField
            label="상태"
            required
            type="select"
            value={form.status}
            onChange={update("status")}
            options={[
              { label: "활성", value: "active" },
              { label: "비활성", value: "inactive" },
              { label: "처분", value: "disposed" },
            ]}
          />
        </div>
        {acquisitionCostLocked && (
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">
            감가상각누계가 존재하는 자산은 장부 정합성을 위해 취득가액을 직접 수정할 수 없습니다.
          </p>
        )}
        {form.depreciationMethod === "units-of-production" && (
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">
            생산량비례법은 실제 생산/사용량 데이터가 연결된 후 감가상각 스케줄을 생성할 수 있습니다. 현재는 자동 월별 스케줄이 생성되지 않습니다.
          </p>
        )}
      </Panel>
    </>
  );
}
