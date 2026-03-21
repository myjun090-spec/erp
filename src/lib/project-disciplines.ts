const PROJECT_DISCIPLINE_OPTIONS = [
  { value: "기계", label: "기계" },
  { value: "전기", label: "전기" },
  { value: "계장/제어", label: "계장/제어" },
  { value: "배관", label: "배관" },
  { value: "토목/건축", label: "토목/건축" },
  { value: "구조", label: "구조" },
  { value: "공정", label: "공정" },
  { value: "품질", label: "품질" },
  { value: "시운전", label: "시운전" },
  { value: "기타", label: "기타" },
] as const;

export const projectDisciplineOptions = [...PROJECT_DISCIPLINE_OPTIONS];

export function isValidProjectDiscipline(value: string) {
  return PROJECT_DISCIPLINE_OPTIONS.some((option) => option.value === value);
}

export function getProjectDisciplineOptions(selectedValue?: string) {
  if (!selectedValue || isValidProjectDiscipline(selectedValue)) {
    return projectDisciplineOptions;
  }

  return [
    ...projectDisciplineOptions,
    {
      value: selectedValue,
      label: `${selectedValue} (기존 값)`,
    },
  ];
}
