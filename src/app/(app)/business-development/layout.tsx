import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "사업기회", href: "/business-development/opportunities" },
  { label: "계약", href: "/business-development/contracts" },
  { label: "거래처", href: "/business-development/parties" },
];

export default function BusinessDevelopmentLayout({
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
