"use client";
import * as THREE from "three";
import path from 'path';
import { writeFile,readFile } from 'fs';
import fs from 'fs';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import axios from 'axios';

// const loadJSON = async (relativePath) => {
//     const fullPath = path.join(process.cwd(), 'public', relativePath);
//     const fileContent = fs.readFileSync(fullPath);
//     return JSON.parse(fileContent);
//   };
  const loadJSON = async (relativePath) => {
    // const fullPath = path.join(process.cwd(), 'public', relativePath);
    const res = await fetch(relativePath);
    return await res.json();
  };


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
    "LeftIndex1",            // 25 - Left Index Base
    "LeftIndex2",            // 26 - Left Index Middle
    "LeftIndex3",            // 27 - Left Index Tip
    "LeftMiddle1",           // 28 - Left Middle Base
    "LeftMiddle2",           // 29 - Left Middle Middle
    "LeftMiddle3",           // 30 - Left Middle Tip
    "LeftPinky1",            // 31 - Left Pinky Base
    "LeftPinky2",            // 32 - Left Pinky Middle
    "LeftPinky3",            // 33 - Left Pinky Tip
    "LeftRing1",             // 34 - Left Ring Base
    "LeftRing2",             // 35 - Left Ring Middle
    "LeftRing3",             // 36 - Left Ring Tip
    "LeftThumb1",            // 37 - Left Thumb Base
    "LeftThumb2",            // 38 - Left Thumb Middle
    "LeftThumb3",            // 39 - Left Thumb Tip
    "RightIndex1",           // 40 - Right Index Base
    "RightIndex2",           // 41 - Right Index Middle
    "RightIndex3",           // 42 - Right Index Tip
    "RightMiddle1",          // 43 - Right Middle Base
    "RightMiddle2",          // 44 - Right Middle Middle
    "RightMiddle3",          // 45 - Right Middle Tip
    "RightPinky1",           // 46 - Right Pinky Base
    "RightPinky2",           // 47 - Right Pinky Middle
    "RightPinky3",           // 48 - Right Pinky Tip
    "RightRing1",            // 49 - Right Ring Base
    "RightRing2",            // 50 - Right Ring Middle
    "RightRing3",            // 51 - Right Ring Tip
    "RightThumb1",           // 52 - Right Thumb Base
    "RightThumb2",           // 53 - Right Thumb Middle
    "RightThumb3"            // 54 - Right Thumb Tip
];

    const PARENT_INDICES = [
    -1,   // 0  - pelvis
    0,    // 1  - left_hip
    0,    // 2  - right_hip
    0,    // 3  - spine1
    1,    // 4  - left_knee
    2,    // 5  - right_knee
    3,    // 6  - spine2
    4,    // 7  - left_ankle
    5,    // 8  - right_ankle
    6,    // 9  - spine3
    7,    // 10 - left_foot
    8,    // 11 - right_foot
    9,    // 12 - neck
    9,    // 13 - left_collar
    9,    // 14 - right_collar
    12,   // 15 - head
    13,   // 16 - left_shoulder
    14,   // 17 - right_shoulder
    16,   // 18 - left_elbow
    17,   // 19 - right_elbow
    18,   // 20 - left_wrist
    19,   // 21 - right_wrist
    15,   // 22 - jaw
    15,   // 23 - left_eye_smplhf
    15,   // 24 - right_eye_smplhf
    20,   // 25 - left_index1
    25,   // 26 - left_index2
    26,   // 27 - left_index3
    20,   // 28 - left_middle1
    28,   // 29 - left_middle2
    29,   // 30 - left_middle3
    20,   // 31 - left_pinky1
    31,   // 32 - left_pinky2
    32,   // 33 - left_pinky3
    20,   // 34 - left_ring1
    34,   // 35 - left_ring2
    35,   // 36 - left_ring3
    20,   // 37 - left_thumb1
    37,   // 38 - left_thumb2
    38,   // 39 - left_thumb3
    21,   // 40 - right_index1
    40,   // 41 - right_index2
    41,   // 42 - right_index3
    21,   // 43 - right_middle1
    43,   // 44 - right_middle2
    44,   // 45 - right_middle3
    21,   // 46 - right_pinky1
    46,   // 47 - right_pinky2
    47,   // 48 - right_pinky3
    21,   // 49 - right_ring1
    49,   // 50 - right_ring2
    50,   // 51 - right_ring3
    21,   // 52 - right_thumb1
    52,   // 53 - right_thumb2
    53    // 54 - right_thumb3
];

const calculateRelativePositions = (joints, parents) => {
    return joints.map((joint, index) => {
        const parentIndex = parents[index];
        if (parentIndex === -1) {
            return new THREE.Vector3(joint[0], joint[1], joint[2]);
        } else {
            const parent = joints[parentIndex];
            return new THREE.Vector3(
                joint[0] - parent[0],
                joint[1] - parent[1],
                joint[2] - parent[2]
            );
        }
    });
};

const createBones = (joints, parents) => {
    const bones = [];
    const relativePositions = calculateRelativePositions(joints, parents);

    relativePositions.forEach((pos, index) => {
        const bone = new THREE.Bone();
        bone.position.copy(pos);
        bone.name = BONE_NAMES[index];
        bone.isBone = true; // Explicitly set isBone
        bones.push(bone);
    });

    parents.forEach((parentIndex, index) => {
        if (parentIndex !== -1) {
            bones[parentIndex].add(bones[index]);
        }
    });

    return bones;
};

export default async function loadModel(name:any) {
    // dynamically set this
    name=encodeURIComponent(name);
   const vertices = await loadJSON(`mesh_json/${name}/vertices.json`);
   const faces = await loadJSON(`mesh_json/${name}/faces.json`);
   const joints = await loadJSON(`mesh_json/${name}/joints.json`);
   const weights = await loadJSON(`mesh_json/${name}/weights.json`);
   const indices = await loadJSON(`mesh_json/${name}/indices.json`);
   const uv =await loadJSON(`mesh_json/${name}/vt.json`)   // (num_vertices x 4)
//    console.log('UV shape:', uv.length, 'x', uv[0].length); 
console.log("reached?")
   const geometry = new THREE.BufferGeometry();
   const verticesArray = new Float32Array(vertices.flat());
   const indicesArray = new Uint16Array(faces.flat());
   const vtArray  = new Float32Array(uv.flat())

   geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
   geometry.setAttribute('uv',new THREE.BufferAttribute(vtArray,2))
   geometry.setIndex(new THREE.BufferAttribute(indicesArray, 1));
   // geometry.computeVertexNormals();

   const skinWeights = new Float32Array(weights.flat());
   const skinIndices = new Uint16Array(indices.flat());
    console.log("1.5?")
   geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));
   geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
   console.log("1?")
   geometry.computeVertexNormals();  // Smooth normals calculation
    console.log("2?")
   // geometry.computeVertexNormals();
   const texture = await loadTextureAsync(`mesh_json/${name}/mesh_albedo.png`);

  console.log("reaced2?")
   // console.log(JSON.stringify(texture, null, 2));
   const material = new THREE.MeshStandardMaterial({
   map: texture,
   // color: 'blue',
   metalness: 0,
   roughness: 1
});


   console.log("reached?");

   
   

   const mesh = new THREE.SkinnedMesh(geometry, material);
   


   // Create bones once and bind them to the SkinnedMesh
   const bones = createBones(joints, PARENT_INDICES);
   const skeleton = new THREE.Skeleton(bones);

   // Bind skeleton to mesh
   mesh.add(bones[0]); // Add root bone to SkinnedMesh
   mesh.bind(skeleton);
   console.log("created mesh successfully")
   const glb_file= await exportToGLB(mesh);
//    uploadGLB(glb_file)
   return name;
//    const skeletonHelper = new THREE.SkeletonHelper(mesh);
   
};
const uploadGLB = async (glbBuffer) => {
    try {
      const response = await axios.post("/api/upload", glbBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
  
      console.log("Upload successful:", response.data);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };
const exportToGLB = async (object) => {
    const exporter = new GLTFExporter();

    try {
        // Parse the object and get the ArrayBuffer for GLB
        const glb = await exporter.parseAsync(object, {
            binary: true,  // Export in GLB format
            trs: true,     // Use position, rotation, and scale
            onlyVisible: true,
            includeCustomExtensions: true
        });

        if (!(glb instanceof ArrayBuffer)) {
            throw new Error("Invalid GLB data: The exported result is not an ArrayBuffer.");
        }

        // Send the GLB file to the server
        const response = await axios.post("api/upload", glb, {
            headers: {
                "Content-Type": "application/octet-stream"
            }
        });
        if (response.data.success) {
            console.log("GLB saved at:", response.data.filePath);
            return response.data.filePath;  // Return the saved file path
        } else {
            throw new Error(`Server failed to save GLB: ${response.data.error}`);
        }
        
    } catch (error) {
        console.error('An error occurred during GLB export:', error);
    }
};
const loadTextureAsync = (url) => {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        console.log("loading texture")
        loader.load(
            url,
            (texture) => {
                // console.log("inside texture")
                texture.flipY = true;  // Optional if your UVs are flipped
                resolve(texture);      // Resolve only when fully loaded
            },
            undefined,                 // Progress callback (optional)
            (err) => reject(err)       // Handle errors
        );
    });
};