import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "전체 공람", href: "/circulation" },
  { label: "미확인", href: "/circulation/unread" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
