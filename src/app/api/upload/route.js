import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    console.log("reached?")
    const data = await req.arrayBuffer(); // Read binary data from request
    const filePath = path.join(process.cwd(), "public", "mesh","mesh.glb");

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Write file
    fs.writeFileSync(filePath, Buffer.from(data));

    console.log("GLB saved at:", filePath);
    return NextResponse.json({ success: true, filePath: "/mesh.glb" });
  } catch (error) {
    console.error("Error saving GLB:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
