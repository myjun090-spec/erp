import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "이용자", href: "/client-case/clients" },
  { label: "욕구사정", href: "/client-case/assessments" },
  { label: "사례계획", href: "/client-case/plans" },
  { label: "서비스연계", href: "/client-case/linkages" },
  { label: "상담기록", href: "/client-case/counseling" },
  { label: "사례종결", href: "/client-case/closures" },
];

export default function ClientCaseLayout({
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
