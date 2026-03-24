import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "직원", href: "/facility-hr" },
  { label: "근태", href: "/facility-hr/attendance" },
  { label: "시설", href: "/facility-hr/rooms" },
  { label: "비품", href: "/facility-hr/supplies" },
  { label: "차량", href: "/facility-hr/vehicles" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SubNav items={subNavItems} />
      {children}
    </div>
  );
}
