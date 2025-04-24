// pages/api/save-audio.ts
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const filename = req.headers.get("x-filename");
  if (!filename) {
    return new Response("Missing X-Filename", { status: 400 });
  }

  const audioPath = path.join(process.cwd(), "public", filename);
  const buffer = await req.arrayBuffer();
  fs.writeFileSync(audioPath, Buffer.from(buffer));

  return new Response(JSON.stringify({ success: true, path: `/${filename}` }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
