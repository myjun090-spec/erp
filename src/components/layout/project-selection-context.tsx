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
  currentProjectStorageKey,
  normalizeProjectId,
  pickDefaultProjectId,
  type ProjectOption,
} from "@/lib/project-scope";

type ProjectSelectionContextValue = {
  currentProjectId: string | null;
  currentProject: ProjectOption | null;
  projects: ProjectOption[];
  projectsLoading: boolean;
  setCurrentProjectId: (projectId: string | null) => void;
};

const ProjectSelectionContext = createContext<ProjectSelectionContextValue | null>(null);

function getInitialProjectId() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeProjectId(window.localStorage.getItem(currentProjectStorageKey));
}

export function ProjectSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(getInitialProjectId);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { signal: controller.signal });
        const json = await response.json();

        if (!json.ok) {
          return;
        }

        const nextProjects = (json.data?.items ?? []).map((item: ProjectOption) => ({
          _id: item._id,
          code: item.code,
          name: item.name,
          status: item.status,
        }));
        const nextDefaultProjectId = normalizeProjectId(json.meta?.defaultProjectId);

        startTransition(() => {
          setProjects(nextProjects);
          setDefaultProjectId(nextDefaultProjectId);
        });
      } catch {
        // Ignore project selector bootstrap errors and keep the rest of the app usable.
      } finally {
        setProjectsLoading(false);
      }
    }

    void loadProjects();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const nextProjectId = pickDefaultProjectId(
      currentProjectId,
      defaultProjectId,
      projects,
    );

    if (nextProjectId !== currentProjectId) {
      setCurrentProjectIdState(nextProjectId);
    }
  }, [currentProjectId, defaultProjectId, projects]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (currentProjectId) {
      window.localStorage.setItem(currentProjectStorageKey, currentProjectId);
      return;
    }

    window.localStorage.removeItem(currentProjectStorageKey);
  }, [currentProjectId]);

  const currentProject = useMemo(
    () => projects.find((project) => project._id === currentProjectId) ?? null,
    [currentProjectId, projects],
  );

  const value = useMemo<ProjectSelectionContextValue>(
    () => ({
      currentProjectId,
      currentProject,
      projects,
      projectsLoading,
      setCurrentProjectId: (projectId) => {
        setCurrentProjectIdState(normalizeProjectId(projectId));
      },
    }),
    [currentProject, currentProjectId, projects, projectsLoading],
  );

  return (
    <ProjectSelectionContext.Provider value={value}>
      {children}
    </ProjectSelectionContext.Provider>
  );
}

export function useProjectSelection() {
  const value = useContext(ProjectSelectionContext);

  if (!value) {
    throw new Error("useProjectSelection must be used within ProjectSelectionProvider.");
  }

  return value;
}
