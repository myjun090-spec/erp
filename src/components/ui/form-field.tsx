import { cn } from "@/lib/cn";

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
} & (
  | {
      type?: "text" | "date" | "email" | "number";
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
    }
  | {
      type: "select";
      value: string;
      onChange: (value: string) => void;
      options: Array<{ label: string; value: string }>;
    }
  | {
      type: "textarea";
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
      rows?: number;
    }
  | {
      type: "readonly";
      value: string;
    }
);

export function FormField(props: FormFieldProps) {
  const { label, required, error, className } = props;

  const baseInput = cn(
    "w-full rounded-xl border bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm text-[color:var(--text)] outline-none transition focus:bg-white",
    error
      ? "border-[color:var(--danger)] focus:border-[color:var(--danger)]"
      : "border-[color:var(--border)] focus:border-[color:var(--primary)]",
  );

  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
        {label}
        {required && (
          <span className="ml-1 text-[color:var(--danger)]">*</span>
        )}
      </span>
      {props.type === "select" ? (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={baseInput}
        >
          <option value="">선택</option>
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : props.type === "textarea" ? (
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          className={cn(baseInput, "resize-none")}
        />
      ) : props.type === "readonly" ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[rgba(250,251,252,0.72)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)]">
          {props.value}
        </div>
      ) : (
        <input
          type={props.type ?? "text"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          inputMode={props.inputMode}
          className={baseInput}
        />
      )}
      {error && (
        <span className="text-[11px] font-medium text-[color:var(--danger)]">{error}</span>
      )}
    </label>
  );
}
