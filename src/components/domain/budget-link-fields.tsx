"use client";

/* stub – 제조 ERP 예산연계 UI 제거됨. 재무 페이지 컴파일용 no-op */

type Props = {
  projectId: string;
  wbsId: string;
  budgetId: string;
  onProjectChange: (v: string) => void;
  onWbsChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onBudgetResolved?: (b: Record<string, unknown> | null) => void;
};

export function BudgetLinkFields(_props: Props) {
  return (
    <p className="text-xs text-[color:var(--text-muted)]">
      예산 연계 기능은 사회복지 ERP에서 제거되었습니다.
    </p>
  );
}
