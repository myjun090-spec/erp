"use client";

import {
  canAccessAction,
  canAccessAnyAction,
} from "@/lib/navigation";

type PermissionGuardProps = {
  permissions: ReadonlyArray<string>;
  permission?: string | null;
  anyOf?: ReadonlyArray<string>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionGuard({
  permissions,
  permission,
  anyOf,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const isAllowed = anyOf && anyOf.length > 0
    ? canAccessAnyAction(permissions, anyOf)
    : canAccessAction(permissions, permission);

  return isAllowed ? <>{children}</> : <>{fallback}</>;
}
