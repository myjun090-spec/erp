import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "ITP", href: "/quality/itps" },
  { label: "검사", href: "/quality/inspections" },
  { label: "NCR", href: "/quality/ncr" },
];

export default function QualityLayout({
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
