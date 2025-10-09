import { NextResponse, type NextRequest } from "next/server";
import {
  createProject,
  deleteProject,
  listProjects,
  touchProject,
} from "@/lib/projectsRepository";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[projects][GET]", error);
    return NextResponse.json(
      { message: "Failed to load projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, selectedModel, bvhPath, userId } = body ?? {};

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Project name is required" },
        { status: 400 },
      );
    }

    const project = await createProject({
      name: name.trim(),
      selectedModel: selectedModel ?? null,
      bvhPath: bvhPath ?? null,
      userId: userId ?? null,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[projects][POST]", error);
    return NextResponse.json(
      { message: "Failed to create project" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "Project id is required" },
      { status: 400 },
    );
  }

  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[projects][DELETE]", error);
    return NextResponse.json(
      { message: "Failed to delete project" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "Project id is required" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "touch";

    switch (action) {
      case "touch": {
        const project = await touchProject(id);
        return NextResponse.json({ project });
      }
      default:
        return NextResponse.json(
          { message: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[projects][PATCH]", error);
    return NextResponse.json(
      { message: "Failed to update project" },
      { status: 500 },
    );
  }
}
