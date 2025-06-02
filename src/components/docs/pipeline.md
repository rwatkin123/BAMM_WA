# BAMM Data Pipeline & Architecture

## Pipeline Overview
The BAMM application processes human motion data through a multi-stage pipeline that converts user inputs into animated 3D avatars:

```
USER INPUT → AI PROCESSING → MOTION DATA → 3D VISUALIZATION
```

## Detailed Data Flow

### 1. **Input Stage**
**Data Sources:**
- **Text Prompts**: Natural language descriptions of motions (e.g., "person walking", "dancing")
- **Audio Files**: WAV/MP3 files for audio-driven motion generation
- **3D Models**: GLB files containing avatar meshes and skeletons
- **Motion Files**: BVH files with pre-recorded motion capture data

**Components:** `Chatbot.tsx`, `FileUploadButton.tsx`, `ImportPanel.tsx`

### 2. **AI Processing Stage**
**Text-to-Motion Pipeline:**
```
Text Prompt → Motion Generation API → BVH Motion Data
└── API: https://handy-lamb-enough.ngrok.app/generate-motion
└── Parameters: motion_length, repeat_times, gpu_id, seed
└── Output: BVH filename for download
```

**Audio-to-Motion Pipeline:**
```
Audio File → Audio Motion API → BVH Motion Data
└── API: https://audio-motion.ngrok.app/generate-motion/
└── Input: FormData with WAV file
└── Output: BVH URL + Audio URL for synchronization
```

### 3. **3D Model Generation**
**GLB Creation Pipeline:**
```
JSON Mesh Data → 3D Model Construction → GLB Export
├── vertices.json (3D coordinates)
├── faces.json (triangle indices)
├── joints.json (skeleton positions)
├── weights.json (skinning weights)
├── indices.json (bone assignments)
├── vt.json (UV coordinates)
└── mesh_albedo.png (texture)
```
**Component:** `create_glb.tsx`

### 4. **Motion Retargeting**
**Skeleton Animation Pipeline:**
```
Source BVH → Target GLB → Retargeted Animation
├── Extract skeleton from BVH
├── Load target avatar from GLB
├── Map bone hierarchies (55-bone SMPL standard)
├── Retarget motion using SkeletonUtils
└── Apply hip normalization for ground alignment
```
**Component:** `Canvas.tsx` → `retargetModel()` function

### 5. **3D Visualization**
**Rendering Pipeline:**
```
GLB Model + BVH Motion → Three.js Scene → WebGL Rendering
├── Load target model (/mesh/mesh.glb)
├── Apply skeletal animations
├── Position camera based on model size
├── Synchronize audio playback (if available)
└── Real-time 3D rendering with controls
```
**Components:** `Canvas.tsx`, `ThreeCanvas.tsx`

## Key Data Formats

| Format | Purpose | Structure | Usage |
|--------|---------|-----------|--------|
| **BVH** | Motion capture data | Hierarchical joint rotations + positions | Animation source |
| **GLB** | 3D models | Mesh + Skeleton + Textures | Avatar rendering |
| **JSON** | Mesh components | Vertices, faces, weights, UV coordinates | Model construction |
| **PNG** | Textures | Albedo maps for material rendering | Visual appearance |

## Data Storage & Management
- **Local Storage**: Audio files and preferences
- **Public Assets**: Static GLB models (`/assets/`, `/mesh/`)
- **API Endpoints**: Motion generation and file listing
- **Dynamic Content**: Generated BVH files and thumbnails

## Component Communication
```
Chatbot → Canvas (BVH filename)
FileUploadButton → Canvas (BVH + Audio URLs)
AvatarGrid → Canvas (Selected avatar)
MeasurementControls → Avatar (Body parameters)
SidebarNav → Layout (Panel switching)
```

## API Integration Details

### Text-to-Motion API
**Endpoint**: `https://handy-lamb-enough.ngrok.app/generate-motion`
**Method**: POST
**Payload**:
```json
{
  "text_prompt": ["walking forward", "waving hand"],
  "motion_length": -1,
  "repeat_times": 1,
  "gpu_id": 0,
  "seed": 1,
  "ext": "generation_fast"
}
```
**Response**:
```json
{
  "filenames": "motion_file_12345.bvh"
}
```

### Audio-to-Motion API
**Endpoint**: `https://audio-motion.ngrok.app/generate-motion/`
**Method**: POST
**Content-Type**: `multipart/form-data`
**Payload**: FormData with WAV file
**Response**:
```json
{
  "bvh_url": "https://api.domain.com/motion/generated_motion.bvh"
}
```

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Components load assets only when needed
2. **Resource Reuse**: Three.js objects shared across renders
3. **Memory Management**: Proper cleanup of WebGL resources
4. **Caching**: Local storage for frequently accessed data

### Bottlenecks & Solutions
- **Large GLB Files**: Progressive loading with loading states
- **BVH Processing**: Async loading with worker threads consideration
- **Real-time Rendering**: Optimized animation loops
- **API Latency**: Loading indicators and error handling

## Error Handling

### Common Failure Points
1. **API Unavailability**: Graceful fallbacks and retry logic
2. **File Loading Errors**: User-friendly error messages
3. **WebGL Issues**: Browser compatibility checks
4. **Memory Leaks**: Proper Three.js resource disposal

### Recovery Strategies
- Automatic retry for network failures
- Fallback to default models when assets fail
- Progressive enhancement for browser capabilities
- Clear error messaging for user action

## Scalability Considerations

### Current Limitations
- Single-user sessions (no multi-user support)
- Synchronous processing for complex motions
- Limited concurrent API requests

### Future Enhancements
- Batch processing for multiple motions
- WebSocket connections for real-time updates
- Progressive loading for large model libraries
- CDN integration for asset delivery

---

*This pipeline enables seamless conversion from user intent to fully animated 3D characters through a robust, extensible architecture.* 