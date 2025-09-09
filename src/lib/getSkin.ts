import * as THREE from "three";

/** Find the hips bone in a bones array, handling colon/no-colon variants. */
function findHipsBone(bones: THREE.Bone[]) {
  return bones.find(
    b => /^mixamorig:?Hips$/i.test(b.name)
  );
}

/** Walk up from a bone until you hit a non-Bone parent — that’s typically the Armature root/group. */
function getArmatureRootFromBone(bone: THREE.Bone): THREE.Object3D {
  let p: THREE.Object3D = bone;
  while (p.parent && (p.parent as any).isBone) p = p.parent;
  return p.parent || p; // return group that holds the bone hierarchy
}

/** For a given skeleton, try to determine its canonical root bone (hips or top-most bone). */
function getSkeletonRootBone(skel: THREE.Skeleton): THREE.Bone | null {
  const hips = findHipsBone(skel.bones);
  if (hips) return hips;

  // Fallback: find a bone whose parent is not a Bone (top-most in the chain)
  const boneSet = new Set(skel.bones);
  for (const b of skel.bones) {
    if (!b.parent || !(b.parent as any).isBone) {
      return b;
    }
  }
  // Last resort: first bone
  return skel.bones[0] || null;
}

/**
 * Find the primary Mixamo rig from a loaded FBX/GLB root.
 * Returns the skeleton to target + a representative skinned mesh + the armature root.
 */
export function findPrimaryMixamoRig(root: THREE.Object3D): {
  mesh: THREE.SkinnedMesh,
  skeleton: THREE.Skeleton,
  hips: THREE.Bone,
  armatureRoot: THREE.Object3D
} | null {
  // 1) collect all skinned meshes
  const skinned: THREE.SkinnedMesh[] = [];
  root.traverse((o: any) => { if (o.isSkinnedMesh) skinned.push(o); });

  if (skinned.length === 0) return null;

  // 2) group meshes by their skeleton *root bone object* identity
  const groups = new Map<THREE.Bone, THREE.SkinnedMesh[]>();

  for (const m of skinned) {
    const skel = m.skeleton;
    if (!skel || skel.bones.length === 0) continue;

    const rootBone = getSkeletonRootBone(skel);
    if (!rootBone) continue;

    const hips = findHipsBone(skel.bones) || rootBone;

    // key by the Hips bone object (or rootBone)
    const key = hips;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  if (groups.size === 0) return null;

  // 3) choose the group whose *skeleton has the most bones*
  let best: { key: THREE.Bone, mesh: THREE.SkinnedMesh } | null = null;
  let bestBoneCount = -1;

  for (const [key, meshes] of groups.entries()) {
    // pick the first mesh in this group as representative
    const candidate = meshes[0];
    const count = candidate.skeleton?.bones.length ?? 0;
    if (count > bestBoneCount) {
      best = { key, mesh: candidate };
      bestBoneCount = count;
    }
  }

  if (!best) return null;

  const hips = best.key;
  const mesh = best.mesh;
  const skeleton = mesh.skeleton;
  const armatureRoot = getArmatureRootFromBone(hips);

  return { mesh, skeleton, hips, armatureRoot };
}
