import { Buffer } from "buffer";
import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabaseClients";
import { updateProject } from "@/lib/projectsRepository";

const bucket = process.env.SUPABASE_STORAGE_BUCKET;

const createErrorResponse = (message: string, status = 400) =>
  NextResponse.json({ message }, { status });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;

  if (!projectId) {
    return createErrorResponse("Project id is required");
  }

  if (!bucket) {
    console.error("SUPABASE_STORAGE_BUCKET env var is missing");
    return createErrorResponse("Storage bucket is not configured", 500);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const selectedModel = formData.get("selectedModel");

    const supabase = getServiceSupabaseClient();

    let uploadedPath: string | undefined;

    if (file instanceof File) {
      if (file.size === 0) {
        return createErrorResponse("Uploaded BVH file is empty");
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const extension = file.name?.toLowerCase().endsWith(".bvh")
        ? ""
        : ".bvh";
      const rawName = file.name
        ? file.name + extension
        : `latest-${Date.now()}.bvh`;
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${projectId}/${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase storage upload failed", uploadError);
        return createErrorResponse(
          uploadError.message || "Failed to upload BVH file",
          500,
        );
      }

      uploadedPath = path;
    }

    if (
      typeof uploadedPath === "undefined" &&
      (selectedModel === null || typeof selectedModel === "undefined")
    ) {
      // Nothing to update—just touch updated_at
      const project = await updateProject({ id: projectId });
      return NextResponse.json({ project, bvhPath: null });
    }

    const project = await updateProject({
      id: projectId,
      bvhPath: uploadedPath,
      selectedModel:
        typeof selectedModel === "string" ? selectedModel : undefined,
    });

    return NextResponse.json({ project, bvhPath: uploadedPath ?? null });
  } catch (error) {
    console.error("[projects][save][POST]", error);
    return createErrorResponse("Failed to save project", 500);
  }
}
