"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type AccountingUnitDetail = {
  _id: string;
  code: string;
  name: string;
  currency: string;
  country: string;
  fiscalYearStartMonth: number;
  periods: Array<{
    periodId: string;
    fiscalYear: number;
    periodNo: number;
    periodLabel: string;
    startDate: string;
    endDate: string;
    closeStatus: string;
  }>;
  status: string;
};

function getPeriodStatusLabel(status: string) {
  switch (status) {
    case "open":
      return "열림";
    case "closed":
      return "마감";
    case "plan":
      return "예정";
    default:
      return status;
  }
}

export default function AccountingUnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const { pushToast } = useToast();
  const [data, setData] = useState<AccountingUnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [periodActionTarget, setPeriodActionTarget] = useState<{
    periodId: string;
    periodLabel: string;
    nextStatus: "open" | "closed";
  } | null>(null);
  const [periodActionSaving, setPeriodActionSaving] = useState(false);
  const [periodCreateSaving, setPeriodCreateSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting-units/${unitId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "회계단위를 불러오지 못했습니다.");
        return;
      }
      setData(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleChangePeriodStatus = async () => {
    if (!periodActionTarget) {
      return;
    }

    setPeriodActionSaving(true);
    try {
      const response = await fetch(`/api/accounting-units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: periodActionTarget.periodId,
          closeStatus: periodActionTarget.nextStatus,
        }),
      });
      const json = await response.json();

      if (!json.ok) {
        pushToast({
          title: "회계기간 상태 변경 실패",
          description: json.message || "회계기간 상태를 변경하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      setPeriodActionTarget(null);
      pushToast({
        title: periodActionTarget.nextStatus === "closed" ? "회계기간 마감 완료" : "회계기간 열기 완료",
        description: `${periodActionTarget.periodLabel} 상태가 업데이트되었습니다.`,
        tone: "success",
      });
      await fetchData();
    } catch {
      pushToast({
        title: "회계기간 상태 변경 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setPeriodActionSaving(false);
    }
  };

  const handleCreateNextPeriod = async () => {
    setPeriodCreateSaving(true);
    try {
      const response = await fetch(`/api/accounting-units/${unitId}`, {
        method: "POST",
      });
      const json = await response.json();

      if (!json.ok) {
        pushToast({
          title: "회계기간 생성 실패",
          description: json.message || "다음 회계기간을 생성하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      pushToast({
        title: "회계기간 생성 완료",
        description: `${json.data?.periodLabel || "다음 기간"}이 추가되었습니다.`,
        tone: "success",
      });
      await fetchData();
    } catch {
      pushToast({
        title: "회계기간 생성 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setPeriodCreateSaving(false);
    }
  };

  if (loading) return <StatePanel variant="loading" title="회계단위 로딩 중" description="회계단위 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="회계단위 조회 실패" description={error || "데이터가 없습니다."} />;

  const tabItems = [
    { value: "overview", label: "기본정보", caption: "회계단위 상세" },
    { value: "periods", label: "회계기간", count: data.periods.length, caption: "기간 관리" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title={data.name}
        description={`${data.code} · ${data.currency} · ${data.country}`}
        meta={[{ label: data.status, tone: data.status === "active" ? "success" : "default" }]}
        actions={
          <Link href="/finance/accounting-units" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">
            목록으로
          </Link>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <Panel className="p-5">
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailField label="코드" value={data.code} />
            <DetailField label="회계단위명" value={data.name} />
            <DetailField label="통화" value={data.currency} />
            <DetailField label="국가" value={data.country} />
            <DetailField label="회계연도 시작" value={`${data.fiscalYearStartMonth}월`} />
            <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : "default"} />} />
          </dl>
        </Panel>
      )}

      {activeTab === "periods" && (
        <DataTable
          title="회계기간"
          description="회계단위의 기간별 개폐 현황입니다."
          actions={
            <PermissionButton
              permission="accounting-unit.period-generate"
              type="button"
              onClick={() => void handleCreateNextPeriod()}
              disabled={periodCreateSaving}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {periodCreateSaving ? "생성 중..." : "다음 기간 생성"}
            </PermissionButton>
          }
          columns={[
            { key: "no", label: "기간" },
            { key: "label", label: "레이블" },
            { key: "start", label: "시작일" },
            { key: "end", label: "종료일" },
            { key: "status", label: "상태" },
            { key: "action", label: "처리", align: "right" },
          ]}
          rows={data.periods.map((item) => ({
            no: item.periodNo,
            label: item.periodLabel,
            start: item.startDate,
            end: item.endDate,
            status: (
              <StatusBadge
                label={getPeriodStatusLabel(item.closeStatus)}
                tone={item.closeStatus === "open" ? "success" : item.closeStatus === "closed" ? "default" : "info"}
              />
            ),
            action: (
              <PermissionButton
                permission={item.closeStatus === "open" ? "accounting-unit.period-close" : "accounting-unit.period-open"}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPeriodActionTarget({
                    periodId: item.periodId,
                    periodLabel: item.periodLabel,
                    nextStatus: item.closeStatus === "open" ? "closed" : "open",
                  });
                }}
                className={
                  item.closeStatus === "open"
                    ? "rounded-full border border-[color:var(--warning)] bg-[rgba(255,243,214,0.92)] px-3 py-1.5 text-xs font-semibold text-[color:var(--warning)]"
                    : "rounded-full border border-[color:var(--primary)] bg-[color:var(--selected)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)]"
                }
              >
                {item.closeStatus === "open" ? "닫기" : "열기"}
              </PermissionButton>
            ),
          }))}
        />
      )}

      <ConfirmDialog
        open={Boolean(periodActionTarget)}
        title={
          periodActionTarget?.nextStatus === "closed"
            ? "회계기간 마감"
            : "회계기간 열기"
        }
        description={
          periodActionTarget
            ? `${
                periodActionTarget.periodLabel
              } 기간을 ${
                periodActionTarget.nextStatus === "closed" ? "마감" : "열기"
              } 처리합니다.`
            : ""
        }
        confirmLabel={
          periodActionSaving
            ? "처리 중..."
            : periodActionTarget?.nextStatus === "closed"
              ? "마감"
              : "열기"
        }
        tone={periodActionTarget?.nextStatus === "closed" ? "warning" : "info"}
        onClose={() => {
          if (periodActionSaving) return;
          setPeriodActionTarget(null);
        }}
        onConfirm={() => {
          if (periodActionSaving) return;
          void handleChangePeriodStatus();
        }}
      />
    </>
  );
}
