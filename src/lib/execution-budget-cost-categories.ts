export const executionBudgetCostCategoryOptions = [
  { label: "자재비", value: "material" },
  { label: "외주비", value: "subcontract" },
  { label: "노무비", value: "labor" },
  { label: "토목비", value: "civil" },
  { label: "제작비", value: "fabrication" },
  { label: "운송비", value: "transport" },
  { label: "물류비", value: "logistics" },
  { label: "시험비", value: "lab" },
  { label: "공통비", value: "general" },
] as const;

const executionBudgetCostCategoryAliasMap = new Map<string, string>([
  ["material", "material"],
  ["자재", "material"],
  ["자재비", "material"],
  ["기자재", "material"],
  ["전력설비", "material"],
  ["케이블", "material"],
  ["계측기기", "material"],
  ["subcontract", "subcontract"],
  ["외주", "subcontract"],
  ["외주비", "subcontract"],
  ["설치", "subcontract"],
  ["설치비", "subcontract"],
  ["labor", "labor"],
  ["노무", "labor"],
  ["노무비", "labor"],
  ["civil", "civil"],
  ["토목", "civil"],
  ["토목비", "civil"],
  ["토공", "civil"],
  ["콘크리트", "civil"],
  ["fabrication", "fabrication"],
  ["제작", "fabrication"],
  ["제작비", "fabrication"],
  ["transport", "transport"],
  ["운송", "transport"],
  ["운송비", "transport"],
  ["logistics", "logistics"],
  ["물류", "logistics"],
  ["물류비", "logistics"],
  ["lab", "lab"],
  ["시험", "lab"],
  ["시험비", "lab"],
  ["general", "general"],
  ["공통", "general"],
  ["공통비", "general"],
]);

export function normalizeExecutionBudgetCostCategory(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "general";
  }

  return executionBudgetCostCategoryAliasMap.get(normalized) ?? normalized;
}

export function getExecutionBudgetCostCategoryLabel(value: string) {
  const normalized = normalizeExecutionBudgetCostCategory(value);

  return (
    executionBudgetCostCategoryOptions.find((option) => option.value === normalized)?.label ?? value
  );
}
