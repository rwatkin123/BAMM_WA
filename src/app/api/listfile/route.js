import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || 'custom';

    if (source === 'mixamo') {
      const mixamoDir = path.join(process.cwd(), 'public','mixamo');
      const allEntries = await fs.promises.readdir(mixamoDir, { withFileTypes: true });
      const files = allEntries
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.fbx'))
        .map((d) => `/mixamo/${d.name}`);

      return new Response(JSON.stringify({ files }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: custom avatars from mesh_json (directories only)
    const dir = path.join(process.cwd(), 'public', 'mesh_json');
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to read directory', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
