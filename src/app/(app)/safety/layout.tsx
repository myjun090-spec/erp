import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "HSE", href: "/safety/hse" },
];

export default function SafetyLayout({
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
