import { Panel } from "@/components/ui/panel";
import type { AdminSummaryItem } from "../_lib/admin-page-types";

type AdminSummaryCardsProps = {
  items: AdminSummaryItem[];
};

export function AdminSummaryCards({ items }: AdminSummaryCardsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <Panel key={item.label} className="p-5">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-muted)]">
            {item.label}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text)]">
            {item.value}
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            {item.caption}
          </p>
        </Panel>
      ))}
    </div>
  );
}
