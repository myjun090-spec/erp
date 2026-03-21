"use client";
import GenericNewPage from "@/components/domain/generic-new-page";

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1}월`,
  value: String(index + 1),
}));

export default function Page() {
  return (
    <GenericNewPage
      eyebrow="Finance"
      title="회계단위 등록"
      description="새로운 회계단위를 등록합니다. 생성 시 현재 월 기준 회계기간이 함께 생성됩니다."
      apiEndpoint="/api/accounting-units"
      backUrl="/finance/accounting-units"
      fields={[
        { key: "code", label: "단위코드", required: true, placeholder: "AU-XXX" },
        { key: "name", label: "단위명", required: true, placeholder: "회계단위 명칭" },
        {
          key: "currency",
          label: "기준통화",
          type: "select",
          options: [
            { label: "KRW", value: "KRW" },
            { label: "USD", value: "USD" },
          ],
        },
        {
          key: "country",
          label: "국가",
          type: "select",
          options: [
            { label: "KR", value: "KR" },
            { label: "US", value: "US" },
          ],
        },
        {
          key: "fiscalYearStartMonth",
          label: "회계연도 시작월",
          type: "select",
          options: monthOptions,
        },
      ]}
      defaultValues={{ currency: "KRW", country: "KR", fiscalYearStartMonth: "1" }}
    />
  );
}
