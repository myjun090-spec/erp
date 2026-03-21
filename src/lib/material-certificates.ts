import { toTrimmedString } from "@/lib/domain-write";

export type MaterialCertificate = {
  type: string;
  certNo: string;
  issuedAt: string;
  validTo: string;
  status: string;
  note: string;
};

const defaultMaterialCertificateStatus = "valid";

function normalizeMaterialCertificate(value: unknown): MaterialCertificate | null {
  if (typeof value === "string") {
    const type = toTrimmedString(value);

    if (!type) {
      return null;
    }

    return {
      type,
      certNo: "",
      issuedAt: "",
      validTo: "",
      status: defaultMaterialCertificateStatus,
      note: "",
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const certificate = value as Record<string, unknown>;
  const type = toTrimmedString(certificate.type);
  const certNo = toTrimmedString(certificate.certNo);

  if (!type && !certNo) {
    return null;
  }

  return {
    type,
    certNo,
    issuedAt: toTrimmedString(certificate.issuedAt),
    validTo: toTrimmedString(certificate.validTo),
    status: toTrimmedString(certificate.status) || defaultMaterialCertificateStatus,
    note: toTrimmedString(certificate.note),
  };
}

export function serializeMaterialCertificates(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as MaterialCertificate[];
  }

  return value
    .map((item) => normalizeMaterialCertificate(item))
    .filter((item): item is MaterialCertificate => item !== null);
}
