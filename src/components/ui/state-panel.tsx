import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

type StatePanelTone = "default" | "info" | "success" | "warning" | "danger";
type StatePanelVariant = "empty" | "loading" | "error";

type StatePanelProps = {
  variant: StatePanelVariant;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: StatePanelTone;
  compact?: boolean;
  className?: string;
};

const toneClassNames: Record<StatePanelTone, string> = {
  default:
    "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]",
  info: "border-[rgba(12,102,228,0.18)] bg-[rgba(233,242,255,0.82)] text-[color:var(--primary)]",
  success:
    "border-[rgba(31,132,90,0.18)] bg-[rgba(223,246,235,0.88)] text-[color:var(--success)]",
  warning:
    "border-[rgba(161,92,7,0.18)] bg-[rgba(255,243,214,0.92)] text-[color:var(--warning)]",
  danger:
    "border-[rgba(201,55,44,0.18)] bg-[rgba(252,235,235,0.92)] text-[color:var(--danger)]",
};

const iconClassNames: Record<StatePanelTone, string> = {
  default: "bg-[color:var(--text-muted)]/12 text-[color:var(--text-muted)]",
  info: "bg-[color:var(--primary)]/12 text-[color:var(--primary)]",
  success: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  warning: "bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
  danger: "bg-[color:var(--danger)]/12 text-[color:var(--danger)]",
};

const variantGlyph: Record<StatePanelVariant, string> = {
  empty: "00",
  loading: "..",
  error: "!!",
};

export function StatePanel({
  variant,
  title,
  description,
  action,
  tone = variant === "error" ? "danger" : variant === "loading" ? "info" : "default",
  compact = false,
  className,
}: StatePanelProps) {
  const isError = variant === "error";

  return (
    <Panel
      className={cn(
        "content-auto border-dashed p-5",
        compact ? "rounded-2xl p-4" : "rounded-[24px] p-6",
        className,
      )}
    >
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={cn(
          "flex flex-col gap-4 rounded-[22px] border px-5 py-5",
          toneClassNames[tone],
        )}
      >
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-mono text-sm font-semibold tracking-[0.18em]",
              iconClassNames[tone],
            )}
          >
            {variantGlyph[variant]}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[color:var(--text)]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </Panel>
  );
}
