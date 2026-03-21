import { toTrimmedString } from "@/lib/domain-write";

export function buildMaterialSnapshot(material: Record<string, unknown>) {
  return {
    materialId: String(material._id),
    materialCode: toTrimmedString(material.materialCode),
    description: toTrimmedString(material.description),
    uom: toTrimmedString(material.uom),
  };
}
