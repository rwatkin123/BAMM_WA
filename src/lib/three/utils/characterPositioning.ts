import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function getCharacterPosition(index: number, totalCharacters: number): [number, number, number] {
  if (totalCharacters === 1) return [0, 0, 0];
  
  const spacing = 3;
  const startOffset = -(totalCharacters - 1) * spacing / 2;
  return [startOffset + index * spacing, 0, 0];
}

export function updateCameraForMultipleCharacters(camera: THREE.PerspectiveCamera, controls: OrbitControls, characterCount: number) {
  const baseDistance = 3;
  const distance = baseDistance + (characterCount - 1) * 1.2;
  const height = 2 + (characterCount - 1) * 0.3;
  
  camera.position.set(0, height, distance);
  controls.target.set(0, 1, 0);
  controls.update();
}