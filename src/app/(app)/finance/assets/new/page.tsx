"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFacilitySelection } from "@/components/layout/facility-selection-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast-provider";
import {
  assetClassOptions,
  depreciationMethodOptions,
} from "@/lib/fixed-assets";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";
import { pickDefaultProjectId } from "@/lib/facility-scope";

type ProjectOption = {
  _id: string;
  code: string;
  name: string;
  status: string;
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function AssetNewPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const { currentFacilityId } = useFacilitySelection();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assetNo: "",
    projectId: "",
    assetClass: "plant-equipment",
    location: "",
    acquisitionDate: getToday(),
    acquisitionCost: "",
    usefulLifeMonths: "60",
    depreciationMethod: "straight-line",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const response = await fetch("/api/assets/options");
        const json = await response.json();
        if (!cancelled && json.ok) {
          const nextProjects = json.data.projects ?? [];
          setProjects(nextProjects);
          setForm((prev) => ({
            ...prev,
            projectId:
              prev.projectId ||
              pickDefaultProjectId(
                currentFacilityId,
                json.meta?.defaultProjectId ?? null,
                nextProjects,
              ) ||
              "",
          }));
        }
      } catch {
        if (!cancelled) {
          pushToast({
            title: "프로젝트 조회 실패",
            description: "프로젝트 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [currentFacilityId, pushToast]);

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
      !form.assetNo.trim() ||
      !form.projectId ||
      !form.assetClass ||
      !form.acquisitionDate ||
      parseFormattedInteger(form.acquisitionCost) <= 0 ||
      parseFormattedInteger(form.usefulLifeMonths) <= 0
    ) {
      pushToast({
        title: "필수 입력",
        description: "자산번호, 프로젝트, 자산분류, 취득일, 취득가액, 내용연수를 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetNo: form.assetNo.trim(),
          projectId: form.projectId,
          assetClass: form.assetClass,
          location: form.location.trim(),
          acquisitionDate: form.acquisitionDate,
          acquisitionCost: parseFormattedInteger(form.acquisitionCost),
          usefulLifeMonths: parseFormattedInteger(form.usefulLifeMonths),
          depreciationMethod: form.depreciationMethod,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        pushToast({
          title: "등록 실패",
          description: json.message || "자산을 등록하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "등록 완료",
        description: "자산이 등록되었습니다.",
        tone: "success",
      });
      router.push("/finance/assets");
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
        eyebrow="Finance"
        title="자산 등록"
        description="새로운 고정자산을 등록합니다."
        actions={
          <>
            <Link
              href="/finance/assets"
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
          <FormField label="자산번호" required value={form.assetNo} onChange={update("assetNo")} placeholder="FA-2026-001" />
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
          <FormField
            label="취득가액"
            required
            value={form.acquisitionCost}
            onChange={update("acquisitionCost")}
            inputMode="numeric"
            placeholder="0"
          />
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
        </div>
        {form.depreciationMethod === "units-of-production" && (
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">
            생산량비례법은 실제 생산/사용량 데이터가 연결된 후 감가상각 스케줄을 생성할 수 있습니다. 현재는 자동 월별 스케줄이 생성되지 않습니다.
          </p>
        )}
      </Panel>
    </>
  );
}
