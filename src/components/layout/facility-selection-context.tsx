"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  currentFacilityStorageKey,
  normalizeFacilityId,
  pickDefaultFacilityId,
  type FacilityOption,
} from "@/lib/facility-scope";

type FacilitySelectionContextValue = {
  currentFacilityId: string | null;
  currentFacility: FacilityOption | null;
  facilities: FacilityOption[];
  facilitiesLoading: boolean;
  setCurrentFacilityId: (facilityId: string | null) => void;
};

const FacilitySelectionContext = createContext<FacilitySelectionContextValue | null>(null);

function getInitialFacilityId() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeFacilityId(window.localStorage.getItem(currentFacilityStorageKey));
}

export function FacilitySelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentFacilityId, setCurrentFacilityIdState] = useState<string | null>(getInitialFacilityId);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [defaultFacilityId, setDefaultFacilityId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadFacilities() {
      try {
        const response = await fetch("/api/facilities", { signal: controller.signal });
        const json = await response.json();

        if (!json.ok) {
          return;
        }

        const nextFacilities = (json.data?.items ?? []).map((item: FacilityOption) => ({
          _id: item._id,
          code: item.code,
          name: item.name,
          facilityType: item.facilityType,
          status: item.status,
        }));
        const nextDefaultFacilityId = normalizeFacilityId(json.meta?.defaultFacilityId);

        startTransition(() => {
          setFacilities(nextFacilities);
          setDefaultFacilityId(nextDefaultFacilityId);
        });
      } catch {
        // Ignore facility selector bootstrap errors and keep the rest of the app usable.
      } finally {
        setFacilitiesLoading(false);
      }
    }

    void loadFacilities();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const nextFacilityId = pickDefaultFacilityId(
      currentFacilityId,
      defaultFacilityId,
      facilities,
    );

    if (nextFacilityId !== currentFacilityId) {
      setCurrentFacilityIdState(nextFacilityId);
    }
  }, [currentFacilityId, defaultFacilityId, facilities]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (currentFacilityId) {
      window.localStorage.setItem(currentFacilityStorageKey, currentFacilityId);
      return;
    }

    window.localStorage.removeItem(currentFacilityStorageKey);
  }, [currentFacilityId]);

  const currentFacility = useMemo(
    () => facilities.find((facility) => facility._id === currentFacilityId) ?? null,
    [currentFacilityId, facilities],
  );

  const value = useMemo<FacilitySelectionContextValue>(
    () => ({
      currentFacilityId,
      currentFacility,
      facilities,
      facilitiesLoading,
      setCurrentFacilityId: (facilityId) => {
        setCurrentFacilityIdState(normalizeFacilityId(facilityId));
      },
    }),
    [currentFacility, currentFacilityId, facilities, facilitiesLoading],
  );

  return (
    <FacilitySelectionContext.Provider value={value}>
      {children}
    </FacilitySelectionContext.Provider>
  );
}

export function useFacilitySelection() {
  const value = useContext(FacilitySelectionContext);

  if (!value) {
    throw new Error("useFacilitySelection must be used within FacilitySelectionProvider.");
  }

  return value;
}
