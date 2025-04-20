// scripts/generateAllPreviews.js
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { loadImage, createCanvas } from 'canvas';
import createGL from 'gl';

const basePath = path.join(process.cwd(), 'public', 'mesh_json');
const folders = fs.readdirSync(basePath).filter(f => fs.existsSync(path.join(basePath, f, 'vertices.json')));

const BONE_NAMES = [/* same list from your working logic */ "Hips", "LeftUpLeg", "RightUpLeg", "Spine", "LeftLeg", "RightLeg", "Spine1", "LeftFoot", "RightFoot", "Spine2", "LeftToe", "RightToe", "Neck", "LeftShoulder", "RightShoulder", "Head", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand", "Jaw", "LeftEye", "RightEye", "LeftIndex1", "LeftIndex2", "LeftIndex3", "LeftMiddle1", "LeftMiddle2", "LeftMiddle3", "LeftPinky1", "LeftPinky2", "LeftPinky3", "LeftRing1", "LeftRing2", "LeftRing3", "LeftThumb1", "LeftThumb2", "LeftThumb3", "RightIndex1", "RightIndex2", "RightIndex3", "RightMiddle1", "RightMiddle2", "RightMiddle3", "RightPinky1", "RightPinky2", "RightPinky3", "RightRing1", "RightRing2", "RightRing3", "RightThumb1", "RightThumb2", "RightThumb3"];
const PARENT_INDICES = [-1,0,0,0,1,2,3,4,5,6,7,8,9,9,9,12,13,14,16,17,18,19,15,15,15,20,25,26,20,28,29,20,31,32,20,34,35,20,37,38,21,40,41,21,43,44,21,46,47,21,49,50,21,52,53];

const createBones = (joints, parents) => {
  const bones = [];
  const positions = joints.map((joint, i) => {
    const parent = parents[i] !== -1 ? joints[parents[i]] : null;
    return parent
      ? new THREE.Vector3(joint[0] - parent[0], joint[1] - parent[1], joint[2] - parent[2])
      : new THREE.Vector3(...joint);
  });
  positions.forEach((pos, i) => {
    const bone = new THREE.Bone();
    bone.position.copy(pos);
    bone.name = BONE_NAMES[i];
    bones.push(bone);
  });
  parents.forEach((p, i) => {
    if (p !== -1) bones[p].add(bones[i]);
  });
  return bones;
};

const loadJSON = (folder, filename) => JSON.parse(fs.readFileSync(path.join(folder, filename), 'utf8'));

const loadTexture = async (folder) => {
  const imgPath = path.join(folder, 'mesh_albedo.png');
  const img = await loadImage(imgPath);
  const texture = new THREE.CanvasTexture(img);
  texture.flipY = true;
  return texture;
};

const renderAvatar = async (folderName) => {
  const folder = path.join(basePath, folderName);
  const outputPath = path.join(folder, 'preview.png');

  const [vertices, faces, joints, weights, indices, uv] = [
    loadJSON(folder, 'vertices.json'),
    loadJSON(folder, 'faces.json'),
    loadJSON(folder, 'joints.json'),
    loadJSON(folder, 'weights.json'),
    loadJSON(folder, 'indices.json'),
    loadJSON(folder, 'vt.json'),
  ];

  const texture = await loadTexture(folder);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices.flat()), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faces.flat()), 1));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv.flat()), 2));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(weights.flat()), 4));
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(indices.flat()), 4));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ map: texture, metalness: 0, roughness: 1 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  const bones = createBones(joints, PARENT_INDICES);
  const skeleton = new THREE.Skeleton(bones);
  mesh.add(bones[0]);
  mesh.bind(skeleton);

  const scene = new THREE.Scene();
  scene.add(mesh);
  scene.add(new THREE.AmbientLight(0xffffff));

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 1, 0);

  const glContext = createGL(512, 512, { preserveDrawingBuffer: true });
  const renderer = new THREE.WebGLRenderer({ context: glContext });
  renderer.setSize(512, 512);
  renderer.render(scene, camera);

  const buffer = Buffer.from(glContext.readPixels(0, 0, 512, 512, glContext.RGBA, glContext.UNSIGNED_BYTE));
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(512, 512);
  imageData.data.set(buffer);
  ctx.putImageData(imageData, 0, 0);

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  console.log(`✅ Saved preview: ${outputPath}`);
};

const run = async () => {
  for (const folder of folders) {
    console.log(`🎨 Rendering ${folder}...`);
    await renderAvatar(folder);
  }
};

run();
