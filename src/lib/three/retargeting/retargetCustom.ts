import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { RetargetResult } from "@/types/three";

export function retargetCustomModel(source: any, targetModel: any): RetargetResult | null {
  let targetSkin: any = null;
  
  targetModel.scene.traverse((child: any) => {
    if (!targetSkin && child.isSkinnedMesh) {
      targetSkin = child;
    }
  });
  
  if (!targetSkin) {
    console.warn('No SkinnedMesh found for custom target model');
    return null;
  }
  
  console.log('Retargeting custom model:', targetModel.name);

  const retargetOptions = {
    hip: 'Hips',
    scale: 0.4,
    getBoneName: function (bone: any) {
      return bone.name;
    }
  };
  
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, retargetOptions);
  console.log('Custom retargetedClip:', retargetedClip);
  console.log('Custom retargetedClip tracks:', retargetedClip.tracks.length);
  console.log('Custom retargetedClip duration:', retargetedClip.duration);
  
  if (retargetedClip.tracks.length === 0) {
    console.log('Custom retargeting failed, trying without options...');
    const fallbackClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip);
    console.log('Custom fallback clip:', fallbackClip);
    if (fallbackClip.tracks.length > 0) {
      const mixer = new THREE.AnimationMixer(targetSkin);
      mixer.clipAction(fallbackClip).play();
      return { mixer, clip: fallbackClip };
    }
  }
  
  const mixer = new THREE.AnimationMixer(targetSkin);
  
  if (retargetedClip.tracks.length > 0) {
    mixer.clipAction(retargetedClip).play();
    return { mixer, clip: retargetedClip };
  } else {
    console.error('No animation tracks found after custom retargeting!');
    return null;
  }
}