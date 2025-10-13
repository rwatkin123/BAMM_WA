import mixamo_targets from "@/lib/mixamo_targets.json";

export function getTargetSkin(targetModel: any, characterName: string) {
  const targetSkin = mixamo_targets.find(target => target.charactername == characterName);
  console.log('Target skin:', targetSkin?.targetskin);
  let candidate = targetSkin ? targetModel.scene.children[targetSkin.targetskin] : undefined;
  if (!candidate) {
    targetModel.scene.traverse((child: any) => {
      if (!candidate && child.isSkinnedMesh) {
        candidate = child;
      }
    });
  }
  return candidate;
}