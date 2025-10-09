import { NextResponse, type NextRequest } from "next/server";
import { deleteProject, getProjectById } from "@/lib/projectsRepository";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ message }, { status });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const project = await getProjectById(id);
    return NextResponse.json({ project });
  } catch (error) {
    console.error("[projects][id][GET]", error);
    return errorResponse("Failed to load project", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[projects][id][DELETE]", error);
    return errorResponse("Failed to delete project", 500);
  }
}

