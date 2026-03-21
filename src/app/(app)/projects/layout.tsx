import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "프로젝트", href: "/projects", match: "exact" as const },
  { label: "현장", href: "/projects/sites" },
  { label: "WBS", href: "/projects/wbs" },
  { label: "실행예산", href: "/projects/execution-budgets" },
];

export default function ProjectsLayout({
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
