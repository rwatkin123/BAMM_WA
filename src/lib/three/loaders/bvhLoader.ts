import * as THREE from "three";

export function getSource(sourceModel: any) {
  console.log('Source model:', sourceModel);
  const skeleton: THREE.Skeleton | undefined = sourceModel.skeleton;
  const clip: THREE.AnimationClip = sourceModel.clip;
  const rootBone = skeleton?.bones?.[0];
  if (!skeleton || !rootBone) {
    throw new Error("BVH source skeleton is missing bones.");
  }
  if (rootBone) {
    skeleton.pose();
  }
  const mixer = new THREE.AnimationMixer(rootBone);
  mixer.clipAction(clip).play();
  return { clip, skeleton, mixer };
}