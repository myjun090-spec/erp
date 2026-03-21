"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type SubNavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

type SubNavProps = {
  items: SubNavItem[];
};

export function SubNav({ items }: SubNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-soft)]">
      {items.map((item) => {
        const isActive =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-[color:var(--selected)] text-[color:var(--primary)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
