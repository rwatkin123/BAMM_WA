import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'public', 'mesh_json');
    console.log("Reading directory:", dir);  // Add this for debugging

    const files = await fs.promises.readdir(dir);
    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error("Error reading directory:", error);  // Log error to console
    return new Response(JSON.stringify({ error: 'Failed to read directory', details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
