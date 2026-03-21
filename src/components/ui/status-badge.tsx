import { cn } from "@/lib/cn";

const toneMap = {
  default:
    "border-transparent bg-[rgba(94,108,132,0.12)] text-[color:var(--text-muted)]",
  info: "border-transparent bg-[rgba(29,122,252,0.14)] text-[color:var(--info)]",
  success:
    "border-transparent bg-[rgba(31,132,90,0.14)] text-[color:var(--success)]",
  warning:
    "border-transparent bg-[rgba(161,92,7,0.14)] text-[color:var(--warning)]",
  danger:
    "border-transparent bg-[rgba(201,55,44,0.14)] text-[color:var(--danger)]",
};

type StatusBadgeProps = {
  label: string;
  tone?: keyof typeof toneMap;
};

export function StatusBadge({
  label,
  tone = "default",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase",
        toneMap[tone],
      )}
    >
      {label}
    </span>
  );
}
