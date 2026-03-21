import { Panel } from "@/components/ui/panel";

type FormSectionProps = {
  title: string;
  description: string;
  fields: Array<{ label: string; value: string }>;
};

export function FormSection({
  title,
  description,
  fields,
}: FormSectionProps) {
  return (
    <Panel className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--text)]">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            {description}
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-medium text-[color:var(--text-muted)]">
          Form Pattern
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-xl border border-[color:var(--border)] bg-[rgba(250,251,252,0.72)] px-4 py-3"
          >
            <div className="text-xs font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
              {field.label}
            </div>
            <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
