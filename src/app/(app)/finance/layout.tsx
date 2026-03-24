import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "전표", href: "/finance/journal-entries" },
  { label: "AP", href: "/finance/ap" },
  { label: "AR", href: "/finance/ar" },
  { label: "계정과목", href: "/finance/accounts" },
  { label: "회계단위", href: "/finance/accounting-units" },
  { label: "자산", href: "/finance/assets" },
  { label: "보조금", href: "/finance/subsidies" },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
