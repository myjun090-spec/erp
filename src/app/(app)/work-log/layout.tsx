import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "주간실적", href: "/work-log" },
  { label: "신규 작성", href: "/work-log/new" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
