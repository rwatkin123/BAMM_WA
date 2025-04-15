import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import axios from "axios"

const path = require('path');

// Bone Names
const BONE_NAMES = [
    "Hips", "LeftUpLeg", "RightUpLeg", "Spine", "LeftLeg", "RightLeg",
    "Spine1", "LeftFoot", "RightFoot", "Spine2", "LeftToe", "RightToe",
    "Neck", "LeftShoulder", "RightShoulder", "Head", "LeftArm", "RightArm",
    "LeftForeArm", "RightForeArm", "LeftHand", "RightHand", "Jaw", "LeftEye",
    "RightEye", "LeftIndex1", "LeftIndex2", "LeftIndex3", "LeftMiddle1",
    "LeftMiddle2", "LeftMiddle3", "LeftPinky1", "LeftPinky2", "LeftPinky3",
    "LeftRing1", "LeftRing2", "LeftRing3", "LeftThumb1", "LeftThumb2",
    "LeftThumb3", "RightIndex1", "RightIndex2", "RightIndex3", "RightMiddle1",
    "RightMiddle2", "RightMiddle3", "RightPinky1", "RightPinky2", "RightPinky3",
    "RightRing1", "RightRing2", "RightRing3", "RightThumb1", "RightThumb2", "RightThumb3"
];

// Parent Indices
const PARENT_INDICES = [
    -1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17,
    18, 19, 15, 15, 15, 20, 25, 26, 20, 28, 29, 20, 31, 32, 20, 34, 35,
    20, 37, 38, 21, 40, 41, 21, 43, 44, 21, 46, 47, 21, 49, 50, 21, 52, 53
];

// Function to create and save GLB file
const createAndSaveGLB = async (data) => {
    try {
        console.log("data",data)
        const { vertices, faces, joints, weights, indices } = data;

        // Validate input data
        if (!vertices || !faces || !joints || !weights || !indices) {
            throw new Error("Missing required data fields in input dictionary.");
        }
        console.log("received_mesh")
        // Create Geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices.flat()), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faces.flat()), 1));
        geometry.computeVertexNormals();

        geometry.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(weights.flat()), 4));
        geometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(indices.flat()), 4));

        // Create Material
        const material = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 0.5,
            roughness: 0.5
        });

        // Create Skinned Mesh
        const mesh = new THREE.SkinnedMesh(geometry, material);
        const bones = createBones(joints, PARENT_INDICES);
        const skeleton = new THREE.Skeleton(bones);

        mesh.add(bones[0]);  // Add root bone to SkinnedMesh
        mesh.bind(skeleton);

        // Define output path
        const outputPath = path.join(process.cwd(), 'public', 'mesh', 'mesh.glb');

        // Export the mesh as GLB
        console.log("export_initiated")
        await exportToGLB(mesh, outputPath);

        return true;  // Success
    } catch (error) {
        console.error('Error generating GLB:', error);
        return error;  // Return the error object
    }
};

// Function to export object as GLB and save to file
const exportToGLB = async (object: any, filePath: any) => {
    try {
        const exporter = new GLTFExporter();

        // Export the object as GLB (binary format)
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
        const response = await axios.post("http://localhost:3000/api/upload", glb, {
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
        console.error("Error exporting or uploading GLB:", error);
        throw error;  // Properly propagate the error
    }
};


// Function to create bones
const createBones = (joints:any, parents:any) => {
    const bones = [];
    const relativePositions = calculateRelativePositions(joints, parents);

    relativePositions.forEach((pos, index) => {
        const bone = new THREE.Bone();
        bone.position.copy(pos);
        bone.name = BONE_NAMES[index];
        bone.isBone = true;  // Explicitly set isBone
        bones.push(bone);
    });

    parents.forEach((parentIndex, index) => {
        if (parentIndex !== -1) {
            bones[parentIndex].add(bones[index]);
        }
    });

    return bones;
};

// Function to calculate relative positions of bones
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

export default createAndSaveGLB;
