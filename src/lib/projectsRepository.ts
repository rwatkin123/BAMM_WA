import type { PostgrestError } from "@supabase/supabase-js";
import { getServiceSupabaseClient } from "@/lib/supabaseClients";
import type { ProjectRow } from "@/types/projects";

export interface CreateProjectInput {
  name: string;
  selectedModel?: string | null;
  bvhPath?: string | null;
  userId?: string | null;
}

export interface UpdateProjectInput {
  id: string;
  selectedModel?: string | null;
  bvhPath?: string | null;
}

const PROJECTS_TABLE = "projects";

const mapInsertPayload = ({
  name,
  selectedModel,
  bvhPath,
  userId,
}: CreateProjectInput) => ({
  name,
  selected_model: selectedModel ?? null,
  bvh_path: bvhPath ?? null,
  user_id: userId ?? null,
});

const wrapError = (error: PostgrestError) => {
  const message = error.message || "Supabase request failed";
  const details = error.details ? ` Details: ${error.details}` : "";
  return new Error(`${message}.${details}`);
};

export const createProject = async (
  input: CreateProjectInput,
): Promise<ProjectRow> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .insert(mapInsertPayload(input))
    .select("*")
    .single();

  if (error) {
    throw wrapError(error);
  }

  if (!data) {
    throw new Error("Supabase returned no project data");
  }

  return data as ProjectRow;
};

export const listProjects = async (): Promise<ProjectRow[]> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw wrapError(error);
  }

  return (data ?? []) as ProjectRow[];
};

export const getProjectById = async (id: string): Promise<ProjectRow> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw wrapError(error);
  }

  if (!data) {
    throw new Error("Project not found");
  }

  return data as ProjectRow;
};

export const touchProject = async (id: string): Promise<ProjectRow> => {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw wrapError(error);
  }

  if (!data) {
    throw new Error("Project not found");
  }

  return data as ProjectRow;
};

export const updateProject = async ({
  id,
  selectedModel,
  bvhPath,
}: UpdateProjectInput): Promise<ProjectRow> => {
  const supabase = getServiceSupabaseClient();
  const payload: Record<string, string | null> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (typeof selectedModel !== "undefined") {
    payload.selected_model = selectedModel;
  }

  if (typeof bvhPath !== "undefined") {
    payload.bvh_path = bvhPath;
  }

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw wrapError(error);
  }

  if (!data) {
    throw new Error("Project not found");
  }

  return data as ProjectRow;
};

export const deleteProject = async (id: string): Promise<void> => {
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq("id", id);

  if (error) {
    throw wrapError(error);
  }
};
