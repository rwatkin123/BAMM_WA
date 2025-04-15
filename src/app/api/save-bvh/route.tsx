import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Handle POST request to save a .bvh file to /public/generated
export async function POST(req: NextRequest) {
  const filename = req.headers.get("x-filename");

  if (!filename) {
    return new Response(JSON.stringify({ error: "Missing X-Filename header" }), {
      status: 400,
    });
  }

  try {
    const dir = path.join(process.cwd(), "public");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, filename);
    const buffer = await req.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    return new Response(JSON.stringify({ success: true, filePath: `${filename}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error saving .bvh file:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
