# create_glb Component

## Purpose
GLB model creation and export utilities. Handles procedural 3D model generation, skeletal animation binding, texture loading, and GLB export functionality.

## Key Features
- **Procedural Model Generation**: Creates 3D models from JSON mesh data
- **SMPL Skeleton Integration**: 55-bone humanoid skeleton structure
- **Texture Application**: Loads and applies albedo textures
- **GLB Export**: Generates downloadable 3D models
- **Avatar Customization**: Measurement-based body adjustments

## Bone Structure
Uses SMPL (Skinned Multi-Person Linear) standard with 55 bones:

```typescript
const BONE_NAMES = [
  "Hips",                  // 0 - ROOT
  "LeftUpLeg",             // 1 - Left Thigh
  "RightUpLeg",            // 2 - Right Thigh
  "Spine",                 // 3 - Lower Spine
  // ... (55 total bones)
];

const PARENT_INDICES = [
  -1,   // 0  - Hips (root)
  0,    // 1  - LeftUpLeg (child of Hips)
  0,    // 2  - RightUpLeg (child of Hips)
  // ... (parent-child relationships)
];
```

## Core Functions

### Main Model Loading
```typescript
function loadModel() {
  return new Promise(async (resolve, reject) => {
    try {
      // Load mesh components
      const vertices = await loadJSONAsync('/vertices.json');
      const faces = await loadJSONAsync('/faces.json');
      const joints = await loadJSONAsync('/joints.json');
      const weights = await loadJSONAsync('/weights.json');
      const indices = await loadJSONAsync('/indices.json');
      const vt = await loadJSONAsync('/vt.json');
      
      // Load texture
      const texture = await loadTextureAsync('/mesh_albedo.png');
      
      // Create 3D model
      const model = createModel(vertices, faces, joints, weights, indices, vt, texture);
      resolve(model);
    } catch (error) {
      reject(error);
    }
  });
}
```

### Skeleton Creation
```typescript
function createBones() {
  const bones = [];
  
  // Create bones based on BONE_NAMES array
  for (let i = 0; i < BONE_NAMES.length; i++) {
    const bone = new THREE.Bone();
    bone.name = BONE_NAMES[i];
    bone.position.set(0, 0, 0);
    bones.push(bone);
  }
  
  // Establish parent-child relationships
  for (let i = 0; i < PARENT_INDICES.length; i++) {
    const parentIndex = PARENT_INDICES[i];
    if (parentIndex !== -1) {
      bones[parentIndex].add(bones[i]);
    }
  }
  
  return bones;
}
```

### GLB Export
```typescript
function exportToGLB(scene) {
  const exporter = new GLTFExporter();
  
  exporter.parse(
    scene,
    function (result) {
      const output = JSON.stringify(result, null, 2);
      saveString(output, 'model.glb');
    },
    { binary: true }
  );
}
```

## Data Sources

### Required JSON Files
- **vertices.json**: 3D coordinates for mesh vertices
- **faces.json**: Triangle indices defining mesh faces
- **joints.json**: Skeleton joint positions
- **weights.json**: Skinning weights for vertex-bone binding
- **indices.json**: Bone assignment indices
- **vt.json**: UV texture coordinates

### Texture Files
- **mesh_albedo.png**: Diffuse color texture

## Mesh Construction Process
1. **Load Data**: Fetch all JSON and texture files
2. **Create Geometry**: Build BufferGeometry from vertices and faces
3. **Apply Textures**: Set up materials with albedo maps
4. **Build Skeleton**: Create bone hierarchy
5. **Skin Binding**: Attach mesh to skeleton with weights
6. **Export GLB**: Generate downloadable model file

## Key Functions

### Bone Positioning
```typescript
function calculateRelativePositions(joints) {
  const relativePositions = new Array(BONE_NAMES.length).fill(null).map(() => [0, 0, 0]);
  
  for (let i = 0; i < BONE_NAMES.length; i++) {
    const parentIndex = PARENT_INDICES[i];
    if (parentIndex !== -1) {
      // Calculate relative position from parent
      relativePositions[i] = [
        joints[i][0] - joints[parentIndex][0],
        joints[i][1] - joints[parentIndex][1],
        joints[i][2] - joints[parentIndex][2]
      ];
    } else {
      // Root bone uses absolute position
      relativePositions[i] = joints[i];
    }
  }
  
  return relativePositions;
}
```

### Avatar Generation Handler
```typescript
async function handleAvatarGeneration() {
  try {
    const model = await loadModel();
    console.log("Model loaded successfully:", model);
    return model;
  } catch (error) {
    console.error("Failed to load model:", error);
    throw error;
  }
}
```

## Material Setup
```typescript
const material = new THREE.MeshStandardMaterial({
  map: texture,                    // Albedo texture
  transparent: true,               // Alpha support
  side: THREE.DoubleSide,         // Two-sided rendering
  skinning: true                  // Enable skeletal animation
});
```

## Dependencies
- **Three.js**: Core 3D functionality
- **GLTFExporter**: GLB file generation
- **axios**: JSON data loading

## Error Handling
- Graceful failures for missing assets
- Console logging for debugging
- Promise-based async operations

## Usage Example
```typescript
// Generate avatar model
const model = await handleAvatarGeneration();

// Export to GLB
exportToGLB(model.scene);
```

## Performance Considerations
- **Async Loading**: Non-blocking file operations
- **Memory Management**: Proper texture disposal
- **Efficient Geometry**: Optimized vertex/face structures
- **Bone Optimization**: Minimal bone hierarchy for performance 