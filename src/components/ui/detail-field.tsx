import { cn } from "@/lib/cn";

type DetailFieldProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

export function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[color:var(--text)]">{value}</dd>
    </div>
  );
}
