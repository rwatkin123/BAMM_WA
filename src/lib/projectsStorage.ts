export interface StoredProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const PROJECTS_STORAGE_KEY = "bamm.projects";

export const loadProjects = (): StoredProject[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((project) => project?.id && project?.name);
  } catch (error) {
    console.warn("Failed to parse stored projects", error);
    return [];
  }
};

export const saveProjects = (projects: StoredProject[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
};
