// scripts/copyAlbedoPreview.js
import fs from 'fs';
import path from 'path';

const avatarName = 'Ant-Man';
const source = path.join('public', 'mesh_json', avatarName, 'mesh_albedo.png');
const destDir = path.join('public', 'avatar_previews');
const dest = path.join(destDir, `${avatarName}.png`);

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, dest);

console.log(`✅ Preview saved to: ${dest}`);
