import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "이슈관리", href: "/operations/issues" },
  { label: "직원배정", href: "/operations/assignment" },
  { label: "인수인계", href: "/operations/handover" },
  { label: "운영보드", href: "/operations/board" },
  { label: "주간보고", href: "/operations/report" },
];

export default function OperationsLayout({
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
