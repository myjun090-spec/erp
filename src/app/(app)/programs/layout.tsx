import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "프로그램", href: "/programs" },
  { label: "세션/활동", href: "/programs/sessions" },
  { label: "참여자", href: "/programs/participants" },
  { label: "만족도조사", href: "/programs/surveys" },
  { label: "성과평가", href: "/programs/evaluations" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
