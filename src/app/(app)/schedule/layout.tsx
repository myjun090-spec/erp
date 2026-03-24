import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "캘린더", href: "/schedule" },
  { label: "목록", href: "/schedule/list" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
