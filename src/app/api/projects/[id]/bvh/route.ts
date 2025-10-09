import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabaseClients";
import { getProjectById } from "@/lib/projectsRepository";

const bucket = process.env.SUPABASE_STORAGE_BUCKET;

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ message }, { status });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!bucket) {
    console.error("SUPABASE_STORAGE_BUCKET env var is missing");
    return errorResponse("Storage bucket is not configured", 500);
  }

  try {
    const { id: projectId } = await context.params;
    const project = await getProjectById(projectId);

    if (!project.bvh_path) {
      return errorResponse("No BVH stored for this project", 404);
    }

    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(project.bvh_path, 60 * 10); // 10 minutes

    if (error || !data?.signedUrl) {
      console.error("Failed to create signed URL", error);
      return errorResponse("Unable to access stored BVH", 500);
    }

    return NextResponse.json({
      url: data.signedUrl,
      path: project.bvh_path,
      project,
      expiresIn: 60 * 10,
    });
  } catch (error) {
    console.error("[projects][bvh][GET]", error);
    return errorResponse("Failed to load BVH", 500);
  }
}

