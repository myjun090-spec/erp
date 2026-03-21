import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "모듈", href: "/manufacturing/modules" },
  { label: "제작지시", href: "/manufacturing/orders" },
  { label: "운송/통관", href: "/manufacturing/shipments" },
];

export default function ManufacturingLayout({
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
