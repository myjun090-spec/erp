import GenericNewPage from "@/components/domain/generic-new-page";
import { generateMaterialCode } from "@/lib/document-numbers";

export default function Page() {
  return <GenericNewPage eyebrow="Supply Chain" title="자재 등록" description="새로운 자재를 등록합니다." apiEndpoint="/api/materials" backUrl="/supply-chain/materials"
    defaultValues={{ materialCode: generateMaterialCode() }}
    fields={[
      { key: "materialCode", label: "자재코드", required: true, type: "readonly" },
      { key: "description", label: "자재명", required: true, placeholder: "자재 명칭" },
      { key: "specification", label: "규격", placeholder: "규격 상세" },
      { key: "uom", label: "단위", required: true, type: "select", options: [{ label: "EA", value: "EA" }, { label: "SET", value: "SET" }, { label: "KG", value: "KG" }, { label: "M", value: "M" }, { label: "LOT", value: "LOT" }] },
      { key: "manufacturerName", label: "제조사", placeholder: "제조사명" },
      { key: "category", label: "분류", type: "select", options: [{ label: "기계", value: "mechanical" }, { label: "전기", value: "electrical" }, { label: "배관", value: "piping" }, { label: "계장", value: "instrument" }] },
    ]} />;
}
