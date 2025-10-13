import * as THREE from "three";

export function getNodePath(node: THREE.Object3D, root: THREE.Object3D): string {
  const segments: string[] = [];
  let current: THREE.Object3D | null = node;
  while (current && current !== root) {
    if (current.name) {
      segments.unshift(current.name);
    } else {
      segments.unshift(current.uuid);
    }
    current = current.parent;
  }
  return segments.join("/");
}

export function remapClipBoneBindings(clip: THREE.AnimationClip, root: THREE.Object3D) {
  const bonePathMap = new Map<string, string>();

  root.traverse((obj) => {
    if ((obj as any).isBone) {
      const path = getNodePath(obj, root);
      if (path) {
        bonePathMap.set(obj.name, path);
      }
    }
  });

  clip.tracks = clip.tracks.map((track) => {
    const match = track.name.match(/\.bones\[(.+?)\]\.(.+)/);
    if (match) {
      const [, boneName, property] = match;
      const path = bonePathMap.get(boneName);
      if (path) {
        const remapped = track.clone();
        remapped.name = `${path}.${property}`;
        return remapped;
      }
    }
    return track;
  });
}