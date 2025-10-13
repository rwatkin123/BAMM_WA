"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, Plus, Trash2 } from "lucide-react";
import type { ProjectRow } from "@/types/projects";

const PROJECTS_ENDPOINT = "/api/projects";

const formatLocaleDateTime = (value: string) =>
  new Date(value).toLocaleString();

const formatLocaleDate = (value: string) =>
  new Date(value).toLocaleDateString();

export default function ProjectsPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch(PROJECTS_ENDPOINT, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Request failed");
        }
        const payload = await response.json();
        setProjects(Array.isArray(payload.projects) ? payload.projects : []);
      } catch (err) {
        console.error("Failed to load projects", err);
        setError("Unable to load projects. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects().catch((err) => {
      console.error("Projects fetch exception", err);
      setLoading(false);
      setError("Unable to load projects. Please try again later.");
    });
  }, []);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [projects],
  );

  const hasProjects = sortedProjects.length > 0;
  const latestUpdated = hasProjects
    ? formatLocaleDateTime(sortedProjects[0].updated_at)
    : null;

  const handleCreateProject = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(PROJECTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Request failed");
      }

      const payload = await response.json();
      const project = payload?.project as ProjectRow | undefined;

      if (!project) {
        throw new Error("Project response malformed");
      }

      setNewProjectName("");
      setProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)]);
      router.push(`/dashboard?projectId=${project.id}`);
    } catch (err) {
      console.error("Failed to create project", err);
      setError("Could not create project. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenProject = async (project: ProjectRow) => {
    router.push(`/dashboard?projectId=${project.id}`);

    try {
      const response = await fetch(`${PROJECTS_ENDPOINT}?id=${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "touch" }),
      });

      if (!response.ok) return;

      const payload = await response.json();
      const updated = payload?.project as ProjectRow | undefined;
      if (updated) {
        setProjects((prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      }
    } catch (err) {
      console.error("Failed to mark project as opened", err);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete project “${name}”?`)
    ) {
      return;
    }

    setDeletingIds((prev) => ({ ...prev, [id]: true }));
    setError(null);

    try {
      const response = await fetch(`${PROJECTS_ENDPOINT}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? "Request failed");
      }

      setProjects((prev) => prev.filter((project) => project.id !== id));
    } catch (err) {
      console.error("Failed to delete project", err);
      setError("Unable to delete the project. Please try again.");
    } finally {
      setDeletingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleClearAll = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Clear all projects?")
    ) {
      return;
    }

    setError(null);

    try {
      await Promise.all(
        projects.map((project) =>
          fetch(`${PROJECTS_ENDPOINT}/${project.id}`, { method: "DELETE" }),
        ),
      );
      setProjects([]);
    } catch (err) {
      console.error("Failed to clear projects", err);
      setError("Unable to clear projects. Please try again.");
    }
  };

  const focusCreateInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.2),_transparent_55%)]" />
      <div className="relative z-10">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-200">
                Projects
              </span>
              <span className="text-sm font-medium text-white/60">
                BAMM Workspace
              </span>
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Back to home
            </Link>
          </div>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
          {error && (
            <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur lg:grid-cols-[minmax(0,1.75fr),minmax(0,1fr)]">
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Plan, iterate, and export motion like a studio team.
              </h1>
              <p className="mt-4 text-sm text-white/70">
                Collect reference rigs, store your Mixamo imports, and jump back into the dashboard exactly where you left off.
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-4 text-sm text-white/80 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <dt className="text-xs uppercase tracking-wide text-white/50">
                    Saved projects
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold">
                    {String(projects.length).padStart(2, "0")}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <dt className="text-xs uppercase tracking-wide text-white/50">
                    Latest activity
                  </dt>
                  <dd className="mt-2 text-sm font-medium">
                    {latestUpdated ?? (loading ? "Loading…" : "—")}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <dt className="text-xs uppercase tracking-wide text-white/50">
                    Ready exports
                  </dt>
                  <dd className="mt-2 text-sm font-medium">
                    Syncs with dashboard
                  </dd>
                </div>
              </dl>
            </div>

            <form
              onSubmit={handleCreateProject}
              className="flex flex-col justify-center gap-6 rounded-3xl border border-white/10 bg-black/30 p-6 shadow-lg shadow-sky-500/10"
            >
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-200">
                  New project
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  Name your next animation workspace
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Projects remember selected avatars, measurements, and recent exports.
                </p>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-wide text-white/60">
                  Project title
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 transition focus-within:border-sky-300/60">
                  <Plus className="h-5 w-5 text-sky-300" />
                  <input
                    ref={inputRef}
                    className="w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                    placeholder="e.g. Motion Study"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    disabled={creating}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-sky-300 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!newProjectName.trim() || creating}
              >
                {creating ? "Creating…" : "Create project"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Recent projects</h2>
                <p className="text-sm text-white/60">
                  Open a workspace to continue editing or exporting.
                </p>
              </div>
              {hasProjects && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear all
                </button>
              )}
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-sm text-white/60">
                Loading projects…
              </div>
            ) : hasProjects ? (
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {sortedProjects.map((project) => (
                  <li
                    key={project.id}
                    className="group flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-sky-300/50 hover:bg-white/10"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400/20 via-transparent to-indigo-500/20 p-4 text-xs text-white/60">
                        Updated {formatLocaleDateTime(project.updated_at)}
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {project.name}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">
                            Created {formatLocaleDate(project.created_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="rounded-full border border-white/10 p-2 text-white/60 transition hover:border-red-400/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Delete ${project.name}`}
                          disabled={Boolean(deletingIds[project.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenProject(project)}
                      className="mt-6 inline-flex items-center justify-between rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300 hover:bg-sky-400/20"
                    >
                      <span>Open workspace</span>
                      <FolderOpen className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center text-sm text-white/60">
                <div className="rounded-full border border-white/10 bg-white/10 p-4">
                  <FolderOpen className="h-6 w-6 text-sky-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-white">
                    No projects yet
                  </p>
                  <p>
                    Start by creating a project — we’ll save your workspace instantly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={focusCreateInput}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 px-4 py-2 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create your first project
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
