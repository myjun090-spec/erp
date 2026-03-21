import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "시운전 패키지", href: "/commissioning/packages" },
  { label: "규제대응", href: "/commissioning/regulatory" },
];

export default function CommissioningLayout({
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
