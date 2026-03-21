"use client";

import { createContext, useContext } from "react";

const ViewerPermissionsContext = createContext<ReadonlyArray<string>>([]);

type ViewerPermissionsProviderProps = {
  permissions: ReadonlyArray<string>;
  children: React.ReactNode;
};

export function ViewerPermissionsProvider({
  permissions,
  children,
}: ViewerPermissionsProviderProps) {
  return (
    <ViewerPermissionsContext.Provider value={permissions}>
      {children}
    </ViewerPermissionsContext.Provider>
  );
}

export function useViewerPermissions() {
  return useContext(ViewerPermissionsContext);
}
