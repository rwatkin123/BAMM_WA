import * as THREE from "three";

type RetargetNameOptions = {
  getBoneName?: (bone: THREE.Bone) => string | undefined;
  names?: Record<string, string>;
};

type BoneSnapshot = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

function getPrimaryBoneAxis(bone: THREE.Bone): THREE.Vector3 | null {
  const origin = new THREE.Vector3();
  const childPos = new THREE.Vector3();
  bone.getWorldPosition(origin);

  for (const child of bone.children) {
    if ((child as any).isBone) {
      (child as THREE.Bone).updateMatrixWorld(true);
      child.getWorldPosition(childPos);
      if (!origin.equals(childPos)) {
        return childPos.sub(origin).normalize();
      }
    }
  }

  return null;
}

function removeTwist(quat: THREE.Quaternion, axis: THREE.Vector3): THREE.Quaternion {
  const axisNorm = axis.clone().normalize();
  if (axisNorm.lengthSq() < 1e-8) return quat.clone();

  const qVec = new THREE.Vector3(quat.x, quat.y, quat.z);
  const projected = axisNorm.clone().multiplyScalar(qVec.dot(axisNorm));
  const twist = new THREE.Quaternion(projected.x, projected.y, projected.z, quat.w).normalize();
  if (twist.lengthSq() < 1e-8) return quat.clone();

  return quat.clone().multiply(twist.clone().invert()).normalize();
}

function mapBoneName(bone: THREE.Bone, options?: RetargetNameOptions): string | undefined {
  if (options?.getBoneName) {
    return options.getBoneName(bone) || undefined;
  }
  if (options?.names && options.names[bone.name]) {
    return options.names[bone.name];
  }
  return bone.name;
}

function findBoneByName(bones: THREE.Bone[], name?: string): THREE.Bone | undefined {
  if (!name) return undefined;
  return bones.find(b => b.name === name);
}

function snapshotSkeleton(skeleton: THREE.Skeleton): BoneSnapshot[] {
  return skeleton.bones.map(bone => ({
    position: bone.position.clone(),
    quaternion: bone.quaternion.clone(),
    scale: bone.scale.clone(),
  }));
}

function restoreSkeleton(skeleton: THREE.Skeleton, snapshot: BoneSnapshot[]): void {
  skeleton.bones.forEach((bone, index) => {
    const saved = snapshot[index];
    if (!saved) return;
    bone.position.copy(saved.position);
    bone.quaternion.copy(saved.quaternion);
    bone.scale.copy(saved.scale);
    bone.updateMatrix();
  });
}

function updateBoneWorldMatrices(bones: THREE.Bone[]): void {
  // update from roots
  const visited = new Set<THREE.Bone>();
  bones.forEach(bone => {
    if (!bone.parent || !(bone.parent as any).isBone) {
      bone.updateMatrixWorld(true);
      visited.add(bone);
    }
  });
  // ensure remaining bones are updated
  bones.forEach(bone => {
    if (!visited.has(bone)) {
      bone.updateMatrixWorld(true);
    }
  });
}

/**
 * Compute per-bone local offset matrices that align the target skeleton's rest pose
 * with the source skeleton's rest pose.
 */
export function computeLocalOffsets(
  target: THREE.SkinnedMesh,
  sourceSkeleton: THREE.Skeleton,
  options?: RetargetNameOptions
): Record<string, THREE.Matrix4> {
  if (!target?.skeleton || !sourceSkeleton) return {};

  const targetSkeleton = target.skeleton;
  const localOffsets: Record<string, THREE.Matrix4> = {};

  const targetSnapshot = snapshotSkeleton(targetSkeleton);
  const sourceSnapshot = snapshotSkeleton(sourceSkeleton);

  const sourceQuat = new THREE.Quaternion();
  const targetQuat = new THREE.Quaternion();
  const offsetQuat = new THREE.Quaternion();
  const zero = new THREE.Vector3(0, 0, 0);
  const one = new THREE.Vector3(1, 1, 1);

  try {
    targetSkeleton.pose();
    sourceSkeleton.pose();

    target.updateMatrixWorld(true);
    updateBoneWorldMatrices(targetSkeleton.bones);
    updateBoneWorldMatrices(sourceSkeleton.bones);

    for (const targetBone of targetSkeleton.bones) {
      const mappedName = mapBoneName(targetBone, options);
      const sourceBone = findBoneByName(sourceSkeleton.bones, mappedName);
      if (!sourceBone) continue;

      targetBone.getWorldQuaternion(targetQuat);
      sourceBone.getWorldQuaternion(sourceQuat);

      offsetQuat.copy(targetQuat).multiply(sourceQuat.clone().invert()).normalize();

      localOffsets[targetBone.name] = new THREE.Matrix4().compose(zero, offsetQuat, one);
    }
  } finally {
    restoreSkeleton(targetSkeleton, targetSnapshot);
    restoreSkeleton(sourceSkeleton, sourceSnapshot);
    updateBoneWorldMatrices(targetSkeleton.bones);
    updateBoneWorldMatrices(sourceSkeleton.bones);
  }

  return localOffsets;
}
