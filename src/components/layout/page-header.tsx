type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: Array<{ label: string; tone?: "default" | "info" | "success" | "warning" | "danger" }>;
  actions?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(233,242,255,0.72))] px-5 py-5 shadow-[var(--shadow-panel)] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--primary)]">
            {eyebrow}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
            {description}
          </p>
        </div>
        {actions ? (
          <div
            className="page-header-actions grid shrink-0 gap-2 sm:flex sm:flex-wrap sm:justify-start xl:justify-end"
            role="group"
            aria-label={`${title} 작업`}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
