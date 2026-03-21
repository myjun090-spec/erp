"use client";

import Link, { type LinkProps } from "next/link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PermissionGuard } from "@/components/auth/permission-guard";

type PermissionLinkProps = LinkProps & {
  permission?: string | null;
  anyOf?: ReadonlyArray<string>;
  className?: string;
  children: React.ReactNode;
};

export function PermissionLink({
  permission,
  anyOf,
  className,
  children,
  ...linkProps
}: PermissionLinkProps) {
  const permissions = useViewerPermissions();

  return (
    <PermissionGuard permissions={permissions} permission={permission} anyOf={anyOf}>
      <Link {...linkProps} className={className}>
        {children}
      </Link>
    </PermissionGuard>
  );
}
