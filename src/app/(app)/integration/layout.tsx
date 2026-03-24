import { SubNav } from "@/components/ui/sub-nav";
const subNavItems = [
  { label: "연계 현황", href: "/integration" },
  { label: "희망e음", href: "/integration/himange" },
  { label: "보탬e", href: "/integration/botame" },
  { label: "e나라도움", href: "/integration/enaradoreum" },
  { label: "시설정보", href: "/integration/swis" },
  { label: "1365", href: "/integration/vol1365" },
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return (<div className="flex flex-col gap-6"><SubNav items={subNavItems} />{children}</div>);
}