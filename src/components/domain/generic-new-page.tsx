"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { formatBusinessTaxIdInput, normalizeBusinessTaxIdForSave } from "@/lib/business-tax-id";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "date" | "select" | "textarea" | "readonly";
  format?: "businessTaxId";
  placeholder?: string;
  options?: { label: string; value: string }[];
};

interface Props { eyebrow: string; title: string; description: string; apiEndpoint: string; backUrl: string; fields: FieldDef[]; defaultValues?: Record<string, string>; transform?: (form: Record<string, string>) => Record<string, unknown>; }

export default function GenericNewPage({ eyebrow, title, description, apiEndpoint, backUrl, fields, defaultValues, transform }: Props) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const initial: Record<string, string> = {};
  fields.forEach(f => { initial[f.key] = defaultValues?.[f.key] ?? ""; });
  const [form, setForm] = useState(initial);
  const numberFieldKeys = new Set(
    fields.filter((field) => field.type === "number").map((field) => field.key),
  );
  const businessTaxIdFieldKeys = new Set(
    fields.filter((field) => field.format === "businessTaxId").map((field) => field.key),
  );
  const update = (key: string) => (value: string) =>
    setForm((prev) => ({
      ...prev,
      [key]: numberFieldKeys.has(key)
        ? formatIntegerInput(value)
        : businessTaxIdFieldKeys.has(key)
          ? formatBusinessTaxIdInput(value)
          : value,
    }));

  const renderField = (field: FieldDef) => {
    const commonProps = {
      label: field.label,
      required: field.required,
      value: form[field.key],
    };

    if (field.type === "select") {
      return (
        <FormField
          key={field.key}
          {...commonProps}
          type="select"
          onChange={update(field.key)}
          options={field.options ?? []}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <FormField
          key={field.key}
          {...commonProps}
          type="textarea"
          onChange={update(field.key)}
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === "number") {
      return (
        <FormField
          key={field.key}
          {...commonProps}
          type="text"
          inputMode="numeric"
          onChange={update(field.key)}
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === "readonly") {
      return (
        <FormField
          key={field.key}
          {...commonProps}
          type="readonly"
        />
      );
    }

    if (field.format === "businessTaxId") {
      return (
        <FormField
          key={field.key}
          {...commonProps}
          type="text"
          inputMode="numeric"
          onChange={update(field.key)}
          placeholder={field.placeholder}
        />
      );
    }

    return (
      <FormField
        key={field.key}
        {...commonProps}
        type={field.type ?? "text"}
        onChange={update(field.key)}
        placeholder={field.placeholder}
      />
    );
  };

  const handleSubmit = async () => {
    const missing = fields.filter(f => f.required && !form[f.key]);
    if (missing.length) { pushToast({ title: "필수 입력", description: `${missing.map(f => f.label).join(", ")} 항목을 입력해 주세요.`, tone: "warning" }); return; }
    setSaving(true);
    try {
      const normalizedForm = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [
          key,
          numberFieldKeys.has(key)
            ? value
              ? String(parseFormattedInteger(value))
              : ""
            : businessTaxIdFieldKeys.has(key)
              ? normalizeBusinessTaxIdForSave(value)
            : value,
        ]),
      );
      const payload = transform ? transform(normalizedForm) : normalizedForm;
      const res = await fetch(apiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.ok) { pushToast({ title: "등록 완료", description: `${title} 데이터가 등록되었습니다.`, tone: "success" }); router.push(backUrl); }
      else pushToast({ title: "등록 실패", description: json.message, tone: "warning" });
    } catch { pushToast({ title: "오류", description: "네트워크 오류", tone: "warning" }); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description}
        meta={[{ label: "Database", tone: "success" }]}
        actions={<><Link href={backUrl} className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">취소</Link><button onClick={handleSubmit} disabled={saving} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button></>} />
      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map(renderField)}
        </div>
      </Panel>
    </>
  );
}
