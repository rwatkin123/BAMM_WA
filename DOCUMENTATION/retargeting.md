# Motion Retargeting Deep Dive

## Overview
Motion retargeting is the core process that transfers skeletal animations from source BVH files to target GLB avatar models. This allows any motion capture data to be applied to any humanoid character, regardless of their original skeleton structure or proportions.

## Retargeting Pipeline

### 1. **Source Motion Extraction**
```typescript
function getSource(sourceModel) {
  const clip = sourceModel.clip;                    // Animation clip data
  const helper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
  const skeleton = new THREE.Skeleton(helper.bones); // Source skeleton
  const mixer = new THREE.AnimationMixer(sourceModel.skeleton.bones[0]);
  mixer.clipAction(sourceModel.clip).play();
  return { clip, skeleton, mixer };
}
```

**Process:**
- Extract animation clip from loaded BVH file
- Create skeleton helper for bone hierarchy
- Initialize animation mixer for playback control
- Return source animation components

### 2. **Target Model Preparation**
```typescript
// Target model loading
const targetModel = await new Promise((resolve, reject) => {
  loader.load('/mesh/mesh.glb', resolve, undefined, reject);
});

// Skeleton binding
targetModel.scene.traverse((child) => {
  if (child.isSkinnedMesh) {
    child.skeleton.pose();           // Apply bind pose
    child.updateMatrixWorld(true);   // Update transformations
  }
});
```

**Process:**
- Load target GLB avatar model
- Apply bind pose to ensure proper initial positioning
- Update world transformation matrices

### 3. **Skeleton Mapping & Retargeting**
```typescript
function retargetModel(source, targetModel) {
  const targetSkin = targetModel.scene.children[0];
  
  // Core retargeting using Three.js SkeletonUtils
  const retargetedClip = SkeletonUtils.retargetClip(
    targetSkin,        // Target skinned mesh
    source.skeleton,   // Source skeleton
    source.clip,       // Source animation clip
    {
      hip: 'Hips',     // Root bone mapping
      getBoneName: function (bone) {
        return bone.name;  // Bone name resolution
      }
    }
  );
  
  // Create animation mixer for target
  const mixer = new THREE.AnimationMixer(targetSkin);
  
  // Apply retargeted animation
  mixer.clipAction(retargetedClip).play();
  return mixer;
}
```

## Bone Mapping Strategy

### SMPL Standard Compliance
The system uses a 55-bone humanoid skeleton following SMPL (Skinned Multi-Person Linear) standards:

**Core Body Hierarchy:**
```
Hips (Root)
├── LeftUpLeg → LeftLeg → LeftFoot → LeftToe
├── RightUpLeg → RightLeg → RightFoot → RightToe
└── Spine → Spine1 → Spine2 → Neck → Head
    ├── LeftShoulder → LeftArm → LeftForeArm → LeftHand
    └── RightShoulder → RightArm → RightForeArm → RightHand
```

**Detailed Bone Names:**
```typescript
const BONE_NAMES = [
  "Hips",                  // 0 - ROOT
  "LeftUpLeg",             // 1 - Left Thigh
  "RightUpLeg",            // 2 - Right Thigh
  "Spine",                 // 3 - Lower Spine
  "LeftLeg",               // 4 - Left Knee
  "RightLeg",              // 5 - Right Knee
  "Spine1",                // 6 - Middle Spine
  "LeftFoot",              // 7 - Left Ankle
  "RightFoot",             // 8 - Right Ankle
  "Spine2",                // 9 - Upper Spine
  "LeftToe",               // 10 - Left Toe
  "RightToe",              // 11 - Right Toe
  "Neck",                  // 12 - Neck Base
  "LeftShoulder",          // 13 - Left Clavicle
  "RightShoulder",         // 14 - Right Clavicle
  "Head",                  // 15 - Head
  "LeftArm",               // 16 - Left Upper Arm
  "RightArm",              // 17 - Right Upper Arm
  "LeftForeArm",           // 18 - Left Elbow
  "RightForeArm",          // 19 - Right Elbow
  "LeftHand",              // 20 - Left Wrist
  "RightHand",             // 21 - Right Wrist
  "Jaw",                   // 22 - Jaw
  "LeftEye",               // 23 - Left Eye
  "RightEye",              // 24 - Right Eye
  // ... (finger bones 25-54)
];

const PARENT_INDICES = [
  -1,   // 0  - Hips (root)
  0,    // 1  - LeftUpLeg (child of Hips)
  0,    // 2  - RightUpLeg (child of Hips)
  0,    // 3  - Spine (child of Hips)
  // ... (parent-child relationships)
];
```

## Hip Position Normalization

### Problem
BVH files often contain absolute world positions that don't align with the target avatar's ground plane.

### Solution
```typescript
// Hip position normalization in retargeted animation
retargetedClip.tracks.forEach((track) => {
  if (track.name.includes('Hips') && track.name.endsWith('.position')) {
    const values = track.values.slice(); // Clone values
    const firstY = values[1];             // First keyframe Y position
    
    // Center hips at ground level (y = 0)
    for (let i = 1; i < values.length; i += 3) {
      values[i] -= firstY; // Subtract initial Y offset
    }
    
    track.values = values;
  }
});
```

**Process:**
1. Identify hip position tracks in animation
2. Extract initial Y-position as offset
3. Subtract offset from all keyframes
4. Result: Character feet aligned with ground plane

## Retargeting Challenges & Solutions

### 1. **Skeleton Proportion Differences**
**Challenge:** Source and target skeletons have different bone lengths
**Solution:** Three.js SkeletonUtils automatically scales rotations and positions based on bone length ratios

### 2. **Bone Name Mapping**
**Challenge:** Different naming conventions between BVH and GLB files
**Solution:** `getBoneName` function provides flexible bone name resolution

### 3. **Root Motion Handling**
**Challenge:** Preserving locomotion while adapting to new character size
**Solution:** Hip normalization maintains relative motion while ensuring ground contact

### 4. **Animation Timing**
**Challenge:** Synchronizing with audio playback
**Solution:** Shared animation mixer with delta time updates

## Technical Implementation Details

### Memory Management
```typescript
// Proper cleanup to prevent memory leaks
useEffect(() => {
  return () => {
    window.removeEventListener("resize", handleResize);
    canvasRef.current?.removeChild(renderer.domElement);
    renderer.dispose(); // Three.js resource cleanup
  };
}, [bvhFile, trigger]);
```

### Animation Loop
```typescript
function animate() {
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);  // Update retargeted animation
  controls.update();               // Camera controls
  renderer.render(scene, camera);  // Render frame
}
renderer.setAnimationLoop(animate);
```

### Camera Auto-Positioning
```typescript
// Automatic camera positioning based on model size
const box = new THREE.Box3().setFromObject(targetModel.scene);
const size = new THREE.Vector3();
box.getSize(size);

const modelHeight = size.y;
const distance = modelHeight * 2.2; // Zoom out based on height
camera.position.set(center.x - modelHeight * 0.5, modelHeight * 1.1, center.z + distance);
controls.target.set(center.x, modelHeight * 0.55, center.z); // Target chest height
```

## Mathematical Foundations

### Bone Length Scaling
```typescript
// Automatic bone length ratio calculation
const sourceBoneLength = sourcebone.length;
const targetBoneLength = targetBone.length;
const scale = targetBoneLength / sourceBoneLength;

// Apply scaling to rotation and position
rotationMatrix.multiplyScalar(scale);
positionVector.multiplyScalar(scale);
```

### Quaternion Interpolation
```typescript
// Smooth rotation transitions using SLERP
const interpolatedRotation = new THREE.Quaternion();
interpolatedRotation.slerpQuaternions(startRotation, endRotation, alpha);
```

### Coordinate System Mapping
- **BVH Coordinate System**: Y-up, right-handed
- **GLB Coordinate System**: Y-up, right-handed (compatible)
- **Hip Rotation**: Applied around Y-axis for character turning

## Performance Optimizations

1. **Skeleton Reuse**: Target skeleton is created once and reused
2. **Efficient Updates**: Only animation mixer updates during render loop
3. **Memory Cleanup**: Proper disposal of Three.js resources
4. **Lazy Loading**: BVH files loaded only when needed
5. **Bone Caching**: Pre-computed bone matrices for common operations

## Audio Synchronization

### Timing Alignment
```typescript
// Audio playback synchronization
const audioPath = localStorage.getItem("audio");
const audioEnabled = localStorage.getItem("audio_enabled") === "true";

if (audioEnabled && audioPath) {
  audioRef.current = new Audio(audioPath);
  audioRef.current.addEventListener("canplaythrough", () => {
    audioRef.current?.play(); // Start audio with animation
  });
}
```

### Loop Handling
```typescript
// Handle audio looping for repeated animations
audioRef.current.addEventListener("ended", () => {
  if (playCount < 2) {
    audioRef.current?.play(); // Replay audio
    playCount++;
  }
});
```

## Debugging & Troubleshooting

### Common Issues

#### 1. **Misaligned Characters**
- **Symptom**: Character floating or sinking through ground
- **Solution**: Check hip normalization values
- **Debug**: Log `firstY` value in hip normalization

#### 2. **Broken Animations**
- **Symptom**: Erratic or missing movements
- **Solution**: Verify bone name mapping
- **Debug**: Compare source and target bone hierarchies

#### 3. **Performance Issues**
- **Symptom**: Low frame rates or freezing
- **Solution**: Ensure proper Three.js resource disposal
- **Debug**: Monitor memory usage in browser dev tools

#### 4. **Ground Penetration**
- **Symptom**: Feet going through floor
- **Solution**: Adjust hip position offset calculation
- **Debug**: Visualize bounding box and ground plane

### Debug Helpers
```typescript
// Skeleton visualization
const skeletonHelper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
scene.add(skeletonHelper);

// Bone name debugging
console.log("Source bones:", source.skeleton.bones.map(b => b.name));
console.log("Target bones:", targetSkin.skeleton.bones.map(b => b.name));

// Animation track inspection
retargetedClip.tracks.forEach(track => {
  console.log(`Track: ${track.name}, Keys: ${track.times.length}`);
});
```

## Future Enhancements

### Potential Improvements
1. **IK (Inverse Kinematics)**: Foot contact constraints
2. **Motion Blending**: Smooth transitions between animations
3. **Facial Animation**: Expression transfer from audio
4. **Clothing Simulation**: Physics-based cloth animation
5. **Muscle Simulation**: More realistic body deformation

### Research Directions
- **Neural Motion Retargeting**: AI-based skeleton mapping
- **Real-time Optimization**: GPU-accelerated retargeting
- **Motion Style Transfer**: Personality-based animation adaptation

---

*This retargeting system enables seamless motion transfer between any humanoid characters while maintaining natural-looking animations and proper ground alignment.* 