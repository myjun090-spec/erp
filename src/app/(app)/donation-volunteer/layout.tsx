import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "후원자", href: "/donation-volunteer/donors" },
  { label: "후원금", href: "/donation-volunteer/donations" },
  { label: "후원물품", href: "/donation-volunteer/in-kind" },
  { label: "봉사자", href: "/donation-volunteer/volunteers" },
  { label: "봉사활동", href: "/donation-volunteer/activities" },
  { label: "봉사시간", href: "/donation-volunteer/hours" },
];

export default function DonationVolunteerLayout({
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
