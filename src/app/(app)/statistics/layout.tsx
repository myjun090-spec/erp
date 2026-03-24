import { SubNav } from "@/components/ui/sub-nav";
const subNavItems = [
  { label: "이용자 통계", href: "/statistics" },
  { label: "사례관리", href: "/statistics/cases" },
  { label: "프로그램", href: "/statistics/programs" },
  { label: "후원/봉사", href: "/statistics/donations" },
  { label: "재무", href: "/statistics/finance" },
  { label: "시설", href: "/statistics/facility" },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return (<div className="flex flex-col gap-6"><SubNav items={subNavItems} />{children}</div>);
}