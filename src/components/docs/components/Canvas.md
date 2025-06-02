# Canvas Component

## Purpose
Main 3D viewport for motion visualization and avatar animation. Handles BVH motion loading, GLB model rendering, skeletal animation retargeting, and audio synchronization.

## Props
```typescript
interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
}
```

## Key Features
- **BVH Motion Loading**: Loads and parses motion capture files
- **GLB Model Rendering**: Displays 3D avatar models
- **Motion Retargeting**: Maps BVH animations to GLB skeletons
- **Audio Synchronization**: Plays audio alongside animations
- **Camera Auto-positioning**: Automatically frames character based on size
- **Lighting Setup**: Optimized lighting for character visualization

## Core Functions

### Motion Pipeline
```typescript
// 1. Load target GLB model
const targetModel = await loader.load('/mesh/mesh.glb');

// 2. Load source BVH motion
const bvhLoader = new BVHLoader();
const sourceModel = await bvhLoader.loadAsync(bvhUrl);

// 3. Retarget skeleton animation
const retargetedMixer = retargetModel(getSource(sourceModel), targetModel);
```

### Key Methods
- **`getSource()`**: Extracts animation clip and skeleton from BVH
- **`retargetModel()`**: Maps BVH skeleton to GLB model using SkeletonUtils
- **Hip Normalization**: Centers character at ground level

## Animation Retargeting
```typescript
function retargetModel(source, targetModel) {
  const targetSkin = targetModel.scene.children[0];
  
  // Retarget using Three.js SkeletonUtils
  const retargetedClip = SkeletonUtils.retargetClip(
    targetSkin,
    source.skeleton,
    source.clip,
    { hip: 'Hips' }
  );
  
  // Apply hip position normalization
  retargetedClip.tracks.forEach((track) => {
    if (track.name.includes('Hips') && track.name.endsWith('.position')) {
      const values = track.values.slice();
      const firstY = values[1];
      for (let i = 1; i < values.length; i += 3) {
        values[i] -= firstY; // Ground alignment
      }
      track.values = values;
    }
  });
  
  return new THREE.AnimationMixer(targetSkin);
}
```

## Camera System
```typescript
// Auto-positioning based on model size
const box = new THREE.Box3().setFromObject(targetModel.scene);
const modelHeight = size.y;
const distance = modelHeight * 2.2;

camera.position.set(
  center.x - modelHeight * 0.5,
  modelHeight * 1.1,
  center.z + distance
);

controls.target.set(center.x, modelHeight * 0.55, center.z);
```

## Audio Integration
- **Local Storage**: Retrieves audio path from localStorage
- **Synchronization**: Starts audio playback with animation
- **Loop Handling**: Replays audio for repeated animations
- **Enable/Disable**: Respects user audio preferences

## Scene Configuration
- **Background**: Gradient from dark to light
- **Lighting**: Ambient + directional lights
- **Shadows**: Enabled for realistic depth
- **Controls**: Orbit controls for user interaction

## Performance Features
- **Resource Cleanup**: Proper disposal of Three.js objects
- **Memory Management**: Removes event listeners and renderers
- **Efficient Rendering**: Only updates necessary components

## State Management
```typescript
useEffect(() => {
  // Initialize scene when bvhFile changes
  if (bvhFile) {
    initializeScene();
  }
  
  // Cleanup on unmount
  return () => {
    cleanupResources();
  };
}, [bvhFile, trigger]);
```

## Dependencies
- **Three.js**: Core 3D rendering
- **BVHLoader**: Motion file parsing
- **GLTFLoader**: Model loading
- **SkeletonUtils**: Animation retargeting
- **OrbitControls**: Camera interaction

## Usage Example
```tsx
<Canvas 
  bvhFile={currentMotionFile}
  trigger={regenerate}
/>
```

## Error Handling
- Graceful fallbacks for loading failures
- Console logging for debugging
- Proper cleanup to prevent memory leaks 