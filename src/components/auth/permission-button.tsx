"use client";

import type { ButtonHTMLAttributes } from "react";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PermissionGuard } from "@/components/auth/permission-guard";

type PermissionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  permission?: string | null;
  anyOf?: ReadonlyArray<string>;
};

export function PermissionButton({
  permission,
  anyOf,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const permissions = useViewerPermissions();

  return (
    <PermissionGuard permissions={permissions} permission={permission} anyOf={anyOf}>
      <button {...buttonProps}>
        {children}
      </button>
    </PermissionGuard>
  );
}
