import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "결재 대기", href: "/approval" },
  { label: "내가 보낸 기안", href: "/approval/sent" },
  { label: "전체 문서함", href: "/approval/all" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
