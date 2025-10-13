import * as THREE from "three";

export function normalizeCharacterScale(model: any, targetHeight: number = 2.0) {
  const box = new THREE.Box3().setFromObject(model.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const currentHeight = size.y;
  const scaleFactor = targetHeight / currentHeight;
  
  console.log(`Character height: ${currentHeight.toFixed(2)} → Scaling by: ${scaleFactor.toFixed(3)}`);
  
  model.scene.scale.setScalar(scaleFactor);
  
  const newBox = new THREE.Box3().setFromObject(model.scene);
  
  const groundOffset = -newBox.min.y;
  model.scene.position.y = groundOffset;
  model.scene.userData = model.scene.userData || {};
  model.scene.userData.normalizedScale = scaleFactor;
  model.scene.userData.groundOffset = groundOffset;
  model.scene.userData.originalHeight = currentHeight;
  model.scene.userData.targetHeight = targetHeight;
  
  return { scaleFactor, newBox, groundOffset };
}