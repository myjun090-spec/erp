import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "일반 발급", href: "/documents" },
  { label: "전자결재 기안", href: "/documents/drafts" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
