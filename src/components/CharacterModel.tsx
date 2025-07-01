import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SkeletonHelper } from "three";
import create_glb from "./create_glb";
import { useEffect, useRef } from "react";

interface CharacterModelProps {
  characterName: string;
  position: [number, number, number];
  scale: number;
  showSkeleton: boolean;
  scene: THREE.Scene;
  onLoaded?: (model: THREE.Group) => void;
}

export default function CharacterModel({
  characterName,
  position,
  scale,
  showSkeleton,
  scene,
  onLoaded,
}: CharacterModelProps) {
  const modelRef = useRef<THREE.Group | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);

  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();

    async function loadModel() {
      // Generate character GLB if needed
      await create_glb(characterName);
      await new Promise((resolve) => setTimeout(resolve, 500));
      loader.load(
        `/mesh/mesh.glb?t=${Date.now()}&char=${encodeURIComponent(characterName)}`,
        (gltf) => {
          if (!mounted) return;
          const model = gltf.scene;
          // Normalize scale
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const currentHeight = size.y;
          const scaleFactor = 2.0 / currentHeight;
          model.scale.setScalar(scaleFactor * scale);
          // Position
          model.position.set(...position);
          // Place on ground
          const newBox = new THREE.Box3().setFromObject(model);
          model.position.y = -newBox.min.y;
          // Add to scene
          scene.add(model);
          modelRef.current = model;
          // Skeleton helper
          if (showSkeleton) {
            model.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                const helper = new SkeletonHelper(child);
                scene.add(helper);
                skeletonHelperRef.current = helper;
              }
            });
          }
          if (onLoaded) onLoaded(model);
        },
        undefined,
        (err) => {
          console.error("Error loading character model:", err);
        }
      );
    }
    loadModel();
    return () => {
      mounted = false;
      // Remove model and skeleton helper from scene
      if (modelRef.current) scene.remove(modelRef.current);
      if (skeletonHelperRef.current) scene.remove(skeletonHelperRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterName, position, scale, showSkeleton, scene]);

  return null; // This is a logic-only component
} 