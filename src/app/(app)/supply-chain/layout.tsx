import { SubNav } from "@/components/ui/sub-nav";

const subNavItems = [
  { label: "공급업체", href: "/supply-chain/vendors" },
  { label: "자재", href: "/supply-chain/materials" },
  { label: "발주", href: "/supply-chain/purchase-orders" },
  { label: "재고", href: "/supply-chain/inventory" },
];

export default function SupplyChainLayout({
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
