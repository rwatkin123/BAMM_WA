import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import create_glb from "./create_glb";
import Chatbot from "./Chatbot";
import { useCharacterControls } from "@/contexts/CharacterControlsContext";
import mixamo_targets from "@/lib/mixamo_targets.json";
import { findPrimaryMixamoRig } from "@/lib/getSkin";
import { computeLocalOffsets } from "@/lib/computeLocalOffsets";
import { saveAs } from "file-saver";
import { parseAssetReference } from "@/lib/assetReference";

function getNodePath(node: THREE.Object3D, root: THREE.Object3D): string {
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

function remapClipBoneBindings(clip: THREE.AnimationClip, root: THREE.Object3D) {
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

type RetargetResult = {
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip;
};

type ModelMetadata = {
  displayName: string;
  isMixamo: boolean;
  source: string;
};

const mixamoOffsetCache = new Map<string, Record<string, THREE.Matrix4>>();
interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
  selectedCharacters: string[];
  onProgressChange?: (progress: number) => void;
  onDurationChange?: (duration: number) => void;
  onTrimRangeChange?: (trimRange: number[]) => void;
  onPlayStateChange?: (playing: boolean) => void;
  multiCharacterMode?: boolean;
  onMultiCharacterModeChange?: (mode: boolean) => void;
  onFileReceived?: (filename: string) => void;
  onSend?: () => void;
  onAvatarUpdate?: () => void;
  onExportHandlersReady?: (handlers: {
    exportSelectedToGLB: () => Promise<void>;
    exportCurrentBVH: () => Promise<void>;
  }) => void;
  onPlaybackHandlersReady?: (handlers: {
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    toggle: () => void;
  }) => void;
}

const CanvasComponent = ({ 
  bvhFile, 
  trigger, 
  selectedCharacters = [],
  onProgressChange,
  onDurationChange,
  onTrimRangeChange,
  onFileReceived,
  onSend,
  onAvatarUpdate,
  onExportHandlersReady,
  onPlaybackHandlersReady,
  onPlayStateChange,
}: CanvasProps) => {

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const clockRef = useRef(new THREE.Clock());

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const trimRangeRef = useRef<[number, number]>([0, 0]);
  useEffect(() => { trimRangeRef.current = trimRange; }, [trimRange]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);

  // Store references to loaded models for transform updates
  const modelsRef = useRef<THREE.Object3D[]>([]);
  // Track metadata for each loaded model (character name, source type)
  const modelMetadataRef = useRef<ModelMetadata[]>([]);
  // Store skeleton helpers
  const skeletonHelpersRef = useRef<THREE.Object3D[]>([]);
  // Store reference to THREE.js scene
  const sceneRef_three = useRef<THREE.Scene | null>(null);
  // Store generated animation clips used for export/playback
  const animationClipsRef = useRef<THREE.AnimationClip[]>([]);
  // Cache the most recently retargeted source clip (from BVH)
  const lastSourceRef = useRef<{ clip: THREE.AnimationClip; skeleton: THREE.Skeleton } | null>(null);
  const bvhUrlRef = useRef<string | null>(null);

  // --- Character transform controls (Use context) ---
  const {
    characterScale,
    setCharacterScale,
    characterRotation,
    setCharacterRotation,
    wireframe,
    setWireframe,
    showSkeleton,
    setShowSkeleton
  } = useCharacterControls();

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const exportSelectedToGLB = useCallback(async () => {
    const models = modelsRef.current;
    if (!models || models.length === 0) {
      throw new Error("No characters available to export.");
    }

    const source = lastSourceRef.current;
    if (!source) {
      throw new Error("No animation available. Generate or load motion before exporting.");
    }

    const exporter = new GLTFExporter();
    const exportGroup = new THREE.Group();
    const exportClips: THREE.AnimationClip[] = [];

    models.forEach((model, index) => {
      const clone = SkeletonUtils.clone(model);
      clone.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          const isStandard = (mat as any).isMeshStandardMaterial;
          const isBasic = (mat as any).isMeshBasicMaterial;
          if (!isStandard && !isBasic) {
            const color = (mat.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(0xffffff);
            const skinning = Boolean(mat.skinning);
            child.material = new THREE.MeshStandardMaterial({ color, skinning, metalness: 0.1, roughness: 0.9 });
          }
        }
      });
      exportGroup.add(clone);

      const metadata = modelMetadataRef.current[index] || {
        displayName: selectedCharacters[index] || `character_${index + 1}`,
        isMixamo: false,
        source: selectedCharacters[index] || `character_${index + 1}`,
      };

      const targetWrapper = { scene: clone };
      let exportResult: RetargetResult | null;

      if (metadata.isMixamo) {
        exportResult = retargetMixamoModel(source, targetWrapper, metadata.source);
        normalizeCharacterScale(targetWrapper, 0.0011);
      } else {
        exportResult = retargetCustomModel(source, targetWrapper);
      }

      if (exportResult) {
        const clip = exportResult.clip.clone();
        remapClipBoneBindings(clip, clone);
        if (!clip.name) {
          clip.name = `Animation_${exportClips.length + 1}`;
        }
        exportClips.push(clip);
        exportResult.mixer.stopAllAction();
        exportResult.mixer.uncacheRoot(clone);
      }
    });

    if (exportClips.length === 0) {
      throw new Error("Failed to retarget animation for export.");
    }

    exportGroup.updateMatrixWorld(true);

    const arrayBuffer = await exporter.parseAsync(exportGroup, {
      binary: true,
      animations: exportClips,
      onlyVisible: true,
      truncateDrawRange: true,
    });

    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Exporter returned invalid data.");
    }

    const fileHint = selectedCharacters[0] || "avatar";
    const baseName = fileHint.split("/").pop()?.replace(/\.[^/.]+$/, "") || "avatar";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${baseName}-${stamp}.glb`;

    const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
    saveAs(blob, filename);
  }, [selectedCharacters]);

  const exportCurrentBVH = useCallback(async () => {
    const bvhUrl = bvhUrlRef.current;
    if (!bvhUrl) {
      throw new Error("No BVH animation available to export.");
    }

    const response = await fetch(bvhUrl, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download BVH (status ${response.status}).`);
    }

    const blob = await response.blob();
    let filename = bvhUrl.split('/').pop() || 'animation.bvh';
    if (!/\.bvh$/i.test(filename)) {
      const metaName = modelMetadataRef.current[0]?.displayName || 'animation';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `${metaName}-${stamp}.bvh`;
    }

    saveAs(blob, filename);
  }, []);

  useEffect(() => {
    if (onExportHandlersReady) {
      onExportHandlersReady({ exportSelectedToGLB, exportCurrentBVH });
    }
  }, [onExportHandlersReady, exportSelectedToGLB, exportCurrentBVH]);

  useEffect(() => {
    bvhUrlRef.current = bvhFile;
  }, [bvhFile]);

  useEffect(() => {
    console.log('[DEBUG] Canvas useEffect triggered', {
      selectedCharacters,
      bvhFile,
      trigger,
      showSkeleton
    });
    if (duration > 0) {
      setTrimRange([0, duration] as [number, number]);
      if (onDurationChange) {
        onDurationChange(duration);
      }
    }
  }, [duration, onDurationChange]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Helper function to normalize character scale
  const normalizeCharacterScale = (model: any, targetHeight: number = 2.0) => {
    const box = new THREE.Box3().setFromObject(model.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Calculate scale factor to make all characters the same height
    const currentHeight = size.y;
    const scaleFactor = targetHeight / currentHeight;
    
    console.log(`Character height: ${currentHeight.toFixed(2)} → Scaling by: ${scaleFactor.toFixed(3)}`);
    
    // Apply uniform scaling
    model.scene.scale.setScalar(scaleFactor);
    
    // Recalculate bounding box after scaling
    const newBox = new THREE.Box3().setFromObject(model.scene);
    
    // Position on ground
    const groundOffset = -newBox.min.y;
    model.scene.position.y = groundOffset;
    model.scene.userData = model.scene.userData || {};
    model.scene.userData.normalizedScale = scaleFactor;
    model.scene.userData.groundOffset = groundOffset;
    model.scene.userData.originalHeight = currentHeight;
    model.scene.userData.targetHeight = targetHeight;
    
    return { scaleFactor, newBox, groundOffset };
  };

  // Helper function to calculate character positions
  const getCharacterPosition = (index: number, totalCharacters: number): [number, number, number] => {
    if (totalCharacters === 1) return [0, 0, 0];
    
    const spacing = 3; // Units between characters
    const startOffset = -(totalCharacters - 1) * spacing / 2;
    return [startOffset + index * spacing, 0, 0];
  };

  // Helper function to adjust camera for multiple characters
  const updateCameraForMultipleCharacters = (camera: THREE.PerspectiveCamera, controls: OrbitControls, characterCount: number) => {
    const baseDistance = 3;
    const distance = baseDistance + (characterCount - 1) * 1.2;
    const height = 2 + (characterCount - 1) * 0.3;
    
    camera.position.set(0, height, distance);
    controls.target.set(0, 1, 0);
    controls.update();
  };

  useEffect(() => {
    if (!sceneRef.current) return;

    const clock = clockRef.current;
    const scene = new THREE.Scene();
    sceneRef_three.current = scene;
    
    // Create sky gradient
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x87CEEB) }, // Light sky blue
        bottomColor: { value: new THREE.Color(0xffffff) }, // White
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Add clouds
    const cloudGeometry = new THREE.SphereGeometry(1, 8, 8);
    const cloudMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.8 
    });
    
    // Create multiple cloud clusters
    for (let i = 0; i < 15; i++) {
      const cloudCluster = new THREE.Group();
      
      // Each cloud cluster has multiple spheres
      const sphereCount = Math.floor(Math.random() * 5) + 3;
      for (let j = 0; j < sphereCount; j++) {
        const cloudSphere = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloudSphere.position.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 2
        );
        cloudSphere.scale.setScalar(Math.random() * 0.8 + 0.5);
        cloudCluster.add(cloudSphere);
      }
      
      // Position cloud clusters in the sky
      cloudCluster.position.set(
        (Math.random() - 0.5) * 200,
        Math.random() * 50 + 30,
        (Math.random() - 0.5) * 200
      );
      cloudCluster.scale.setScalar(Math.random() * 2 + 1);
      
      scene.add(cloudCluster);
    }
    


    const textureLoader = new THREE.TextureLoader();
    const gridTexture = textureLoader.load('/textures/grid.png');
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(1000, 1000);

    const groundMat = new THREE.MeshBasicMaterial({ map: gridTexture });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), groundMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    scene.add(plane);

    const container = sceneRef.current;
    const { clientWidth, clientHeight } = container;

    const viewportWidth = clientWidth > 0 ? clientWidth : window.innerWidth;
    const viewportHeight = clientHeight > 0 ? clientHeight : window.innerHeight;

    const camera = new THREE.PerspectiveCamera(
      45,
      viewportWidth / viewportHeight,
      1,
      2000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(viewportWidth, viewportHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    if (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.minPolarAngle = 0; // Prevent going below the grid (0 = horizontal)
    controls.maxPolarAngle = Math.PI / 2; // Allow full 180 degree view above
    controls.target.set(0, 1, 0);

    // Enhanced lighting setup for better model visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Add hemisphere light for more natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0xffffff, 0.6);
    scene.add(hemisphereLight);

    // Add directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Add point light for additional illumination
    const pointLight = new THREE.PointLight(0xffffff, 0.7, 100);
    pointLight.position.set(-10, 5, 10);
    scene.add(pointLight);

    // Add another point light from the opposite side
    const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight2.position.set(10, 5, -10);
    scene.add(pointLight2);

    // Add spotlight focused on character area for dramatic lighting
    const spotLight = new THREE.SpotLight(0xffffff, 1.2, 50, Math.PI / 6, 0.3, 1);
    spotLight.position.set(0, 15, 5);
    spotLight.target.position.set(0, 0, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 0.5;
    spotLight.shadow.camera.far = 50;
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Add overhead point lights for better character illumination
    const overheadLight1 = new THREE.PointLight(0xffffff, 0.8, 30);
    overheadLight1.position.set(-5, 8, 0);
    scene.add(overheadLight1);

    const overheadLight2 = new THREE.PointLight(0xffffff, 0.8, 30);
    overheadLight2.position.set(5, 8, 0);
    scene.add(overheadLight2);

    // Add warm fill light for character warmth
    const warmLight = new THREE.PointLight(0xffe4b5, 0.6, 40);
    warmLight.position.set(0, 6, -8);
    scene.add(warmLight);

    let mixers: THREE.AnimationMixer[] = [];
    modelsRef.current = [];
    // Remove old skeleton helpers
    skeletonHelpersRef.current.forEach(helper => scene.remove(helper));
    skeletonHelpersRef.current = [];

    async function setupModels() {
      const loader = new GLTFLoader();
      const fbxLoader = new FBXLoader();
      const targetModels: any[] = [];
      
      // Clear previous mixers
      mixers = [];
      mixersRef.current = [];
      animationClipsRef.current = [];
      modelMetadataRef.current = [];

      if (selectedCharacters.length === 0) {
        // NO CHARACTERS SELECTED: Show default mesh.glb
        try {
          const targetModel: any = await new Promise((resolve, reject) => {
            loader.load('/mesh/mesh.glb', resolve, undefined, reject);
          });

          scene.add(targetModel.scene);
          targetModel.scene.userData = targetModel.scene.userData || {};
          targetModel.scene.userData.modelName = "default";
          modelsRef.current = [targetModel.scene];
          modelMetadataRef.current = [{ displayName: "default", isMixamo: false, source: '/mesh/mesh.glb' }];


          targetModel.scene.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              child.skeleton.pose();
              child.updateMatrixWorld(true);
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // 🔧 NEW: Normalize default character scale
          const { scaleFactor, groundOffset } = normalizeCharacterScale(targetModel);
          targetModel.scene.userData.characterScaleMultiplier = characterScale;
          targetModel.scene.scale.setScalar(scaleFactor * characterScale);
          targetModel.scene.position.y = groundOffset;

          // Center the single character
          const box = new THREE.Box3().setFromObject(targetModel.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          targetModel.scene.position.x -= size.x * 0.5;

          const modelHeight = size.y;
          const distance = modelHeight * 2.2;
          camera.position.set(center.x - modelHeight * 0.5, modelHeight * 1.1, center.z + distance);
          controls.target.set(center.x, modelHeight * 0.55, center.z);
          controls.update();

          targetModels.push(targetModel);

          // Add skeleton helper if enabled
          if (showSkeleton) {
            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                const helper = new THREE.SkeletonHelper(child);
                scene.add(helper);
                skeletonHelpersRef.current.push(helper);
              }
            });
          }
        } catch (error) {
          console.error("Failed to load default mesh.glb:", error);
        }
      } else {
        // CHARACTERS SELECTED: Load each character (custom or Mixamo)
        setLoadingCharacters(true);
        
        for (let i = 0; i < selectedCharacters.length; i++) {
          const reference = selectedCharacters[i];
          const asset = parseAssetReference(reference);
          const label = asset.filename || reference;
          const extension = asset.extension;
          const isMixamoSource = Boolean(extension === 'fbx' || reference.includes('/mixamo/'));
          const position = getCharacterPosition(i, selectedCharacters.length);

          try {
            console.log(`Loading character ${i + 1}/${selectedCharacters.length}: ${label}`);
            let targetModel: any;

            if (isMixamoSource) {
              const fbx: any = await new Promise((resolve, reject) => {
                fbxLoader.load(asset.url, resolve, undefined, reject);
              });
              targetModel = { scene: fbx };
            } else if (extension === 'glb' || asset.url.startsWith('blob:')) {
              targetModel = await new Promise((resolve, reject) => {
                loader.load(asset.url, resolve, undefined, reject);
              });
            } else {
              await create_glb(reference);
              await new Promise(resolve => setTimeout(resolve, 500));
              targetModel = await new Promise((resolve, reject) => {
                loader.load(`/mesh/mesh.glb?t=${Date.now()}&char=${i}`, resolve, undefined, reject);
              });
            }

            scene.add(targetModel.scene);
            targetModel.scene.userData = targetModel.scene.userData || {};
            targetModel.scene.userData.modelName = label;
            modelsRef.current.push(targetModel.scene);
            modelMetadataRef.current.push({
              displayName: label,
              isMixamo: isMixamoSource,
              source: reference,
            });

            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                child.skeleton.pose();
                child.updateMatrixWorld(true);
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const { scaleFactor, groundOffset } = normalizeCharacterScale(targetModel, 2.0);
            targetModel.scene.userData.characterScaleMultiplier = characterScale;
            targetModel.scene.scale.setScalar(scaleFactor * characterScale);
            targetModel.scene.position.y = groundOffset;
            console.log(`Character ${i + 1} (${label}) scaled by: ${scaleFactor.toFixed(3)}`);

            targetModel.scene.position.x += position[0];
            targetModel.scene.position.z += position[2];

            targetModels.push(targetModel);

            if (showSkeleton) {
              targetModel.scene.traverse((child: any) => {
                if (child.isSkinnedMesh) {
                  const helper = new THREE.SkeletonHelper(child);
                  scene.add(helper);
                  skeletonHelpersRef.current.push(helper);
                }
              });
            }
          } catch (error) {
            console.error(`Failed to load character ${label}:`, error);
          }
        }

        // Update camera for multiple characters
        updateCameraForMultipleCharacters(camera, controls, selectedCharacters.length);
        setLoadingCharacters(false);
      }

      // Apply BVH motion to all characters
      if (bvhFile && targetModels.length > 0) {
        try {
          const sourceModel: any = await new Promise((resolve, reject) => {
            fetch(bvhFile, {
              headers: {
                'ngrok-skip-browser-warning': 'true'
              }
            })
              .then(res => res.arrayBuffer())
              .then(buffer => {
                // Parse BVH from buffer
                const loader = new BVHLoader();
                const result = loader.parse(new TextDecoder().decode(buffer));
                resolve(result);
              });
          });

          const source = getSource(sourceModel);
          lastSourceRef.current = source;
          
          animationClipsRef.current = [];

          // Create mixer for each character
          const retargetResults = targetModels.map((targetModel, index) => {
            const metadata = modelMetadataRef.current[index] || {
              displayName: selectedCharacters[index] || '',
              isMixamo: false,
              source: selectedCharacters[index] || '',
            };
            const { displayName, isMixamo, source: characterKey } = metadata;
            console.log(`Applying motion to character ${index + 1}: ${displayName}`);
            const retargetName = isMixamo ? characterKey : displayName;
            const result = retargetModel(source, targetModel, isMixamo , retargetName);
            return result;
          }).filter((result): result is RetargetResult => result !== null);

          mixers = retargetResults.map(result => result.mixer);
          animationClipsRef.current = retargetResults.map(result => result.clip);

          // targetModels.forEach(model => {
          //   model.scene.position.x += 10
          // });

          mixersRef.current = mixers;
          if (retargetResults.length > 0) {
            setDuration(retargetResults[0].clip.duration);
          } else {
            setDuration(0);
          }

          // Audio setup
          const audioPath = localStorage.getItem("audio");
          const audioEnabled = localStorage.getItem("audio_enabled") === "true";

          if (audioEnabled && audioPath) {
            audioRef.current = new Audio(audioPath);
            audioRef.current.load();
          }
        } catch (error) {
          console.error("Failed to load BVH file:", error);
        }
      }

      // After mixers are set up, ensure model is in correct pose
      if (mixersRef.current.length > 0) {
        mixersRef.current.forEach(mixer => {
          mixer.setTime(trimRangeRef.current[0]);
          mixer.update(0); // Force update pose
        });
      }
    }

    setupModels().then(() => {
      // After mixers are set up, ensure model is in correct pose
      if (mixersRef.current.length > 0) {
        mixersRef.current.forEach(mixer => {
          mixer.setTime(trimRangeRef.current[0]);
          mixer.update(0); // Force update pose
        });
      }
    });


    // ONE animation/render loop for the whole scene:
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();

      if (mixersRef.current.length && isPlayingRef.current) {
        const currentTime = mixersRef.current[0].time;

        if (currentTime >= trimRangeRef.current[1]) {
          // Hit trim-end → stop
          mixersRef.current.forEach(m => m.setTime(trimRangeRef.current[1]));
          if (audioRef.current) audioRef.current.pause();
        } else {
          mixersRef.current.forEach(m => m.update(delta));
          setProgress(currentTime);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    });

    const onWindowResize = () => {
      if (!sceneRef.current) return;
      const { clientWidth: width, clientHeight: height } = sceneRef.current;
      if (height === 0 || width === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    window.addEventListener("resize", onWindowResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && sceneRef.current) {
      resizeObserver = new ResizeObserver(() => {
        onWindowResize();
      });
      resizeObserver.observe(sceneRef.current);
    }
    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (resizeObserver && sceneRef.current) {
        resizeObserver.unobserve(sceneRef.current);
      }
      renderer.setAnimationLoop(null);
      renderer.dispose();
      mixers.forEach(mixer => mixer.stopAllAction());
    };
  }, [selectedCharacters, bvhFile, trigger, showSkeleton]);

  // Update scale, rotation, and skinning options when controls change (RESTORED: Original working code)
  useEffect(() => {
    modelsRef.current.forEach(model => {
      if (model) {
        const baseScale = (model as any)?.userData?.normalizedScale ?? 1;
        (model as any).userData = (model as any).userData || {};
        (model as any).userData.characterScaleMultiplier = characterScale;
        model.scale.setScalar(baseScale * characterScale);
        model.rotation.y = (characterRotation * Math.PI) / 180;
        // Update skinning options for all SkinnedMesh children
        model.traverse((child: any) => {
          if (child.isSkinnedMesh && child.material) {
            child.material.wireframe = wireframe;
            child.material.needsUpdate = true;
          }
        });
      }
    });
  }, [characterScale, characterRotation, wireframe]);

  // Update skeleton helpers when showSkeleton changes (RESTORED: Original working code)
  useEffect(() => {
    const scene = sceneRef_three.current;
    if (!scene) return;

    // Remove existing skeleton helpers
    skeletonHelpersRef.current.forEach(helper => {
      if (helper.parent) {
        helper.parent.remove(helper);
      }
    });
    skeletonHelpersRef.current = [];

    // Add skeleton helpers if enabled
    if (showSkeleton) {
      modelsRef.current.forEach(model => {
        if (model) {
          model.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              const helper = new THREE.SkeletonHelper(child);
              scene.add(helper);
              skeletonHelpersRef.current.push(helper);
            }
          });
        }
      });
    }
  }, [showSkeleton]);

  // 🔧 FIXED Play/Pause Handler with Debug Logging
  const handlePlayPause = useCallback(() => {
    const mixers = mixersRef.current;

    console.log("Play button clicked, mixers:", mixers.length);

    if (mixers.length > 0) {
      if (isPlaying) {
        // PAUSE: Stop all mixers
        console.log("Pausing mixers");
        mixers.forEach((mixer, index) => {
          mixer.timeScale = 0;
          console.log(`Mixer ${index} paused, current time:`, mixer.time);
        });
      } else {
        // PLAY: Start all mixers
        console.log("Starting mixers from time:", mixers[0]?.time || 0);
        
        mixers.forEach((mixer, index) => {
          // If mixer is outside trim range, reset to start
          if (mixer.time < trimRange[0] || mixer.time >= trimRange[1]) {
            mixer.setTime(trimRange[0]);
            console.log(`Mixer ${index} reset to:`, trimRange[0]);
          }
          
          // Set time scale to 1 to play
          mixer.timeScale = 1;
          console.log(`Mixer ${index} started, timeScale:`, mixer.timeScale, "time:", mixer.time);
        });
        
        // Update progress to current position
        if (mixers[0]) {
          setProgress(mixers[0].time);
        }
      }
    } else {
      console.error("No mixers available!");
    }

    // Handle audio
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.currentTime < trimRange[0] || audioRef.current.currentTime >= trimRange[1]) {
          audioRef.current.currentTime = trimRange[0];
        }
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    }
    
    // Toggle play state
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    isPlayingRef.current = nextState;
    onPlayStateChange?.(nextState);
    console.log("Play state changed to:", nextState);
  }, [trimRange, onPlayStateChange, isPlaying]);

  const handleSeek = useCallback((newTime: number) => {
    const clampedTime = Math.max(trimRange[0], Math.min(newTime, trimRange[1]));
    const mixers = mixersRef.current;
    mixers.forEach(mixer => {
      mixer.setTime(clampedTime);
      mixer.update(0); // Force update pose
    });
    if (audioRef.current) audioRef.current.currentTime = clampedTime;
    setProgress(clampedTime);
    // Force render if not playing
    if (!isPlayingRef.current && rendererRef.current && sceneRef_three.current && cameraRef.current) {
      rendererRef.current.render(sceneRef_three.current, cameraRef.current);
    }
  }, [trimRange]);

  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(progress);
    }
  }, [progress, onProgressChange]);

  useEffect(() => {
    if (onPlaybackHandlersReady) {
      const handlers = {
        play: () => {
          if (!isPlayingRef.current) {
            handlePlayPause();
          }
        },
        pause: () => {
          if (isPlayingRef.current) {
            handlePlayPause();
          }
        },
        seek: (time: number) => {
          handleSeek(time);
        },
        toggle: () => {
          handlePlayPause();
        },
      };
      onPlaybackHandlersReady(handlers);
    }
  }, [onPlaybackHandlersReady, handlePlayPause, handleSeek]);

  return (
    <div style={{ position: "relative", height: "100%" }} className="bg-slate-50">
      <div ref={sceneRef} className="h-full" />
      
      <div className="absolute top-6 left-6 z-50 flex max-w-xs flex-col gap-3">
        {loadingCharacters && (
          <div className="rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span>Loading {selectedCharacters.length} character{selectedCharacters.length !== 1 ? 's' : ''}...</span>
            </div>
          </div>
        )}

        {selectedCharacters.length > 0 && !loadingCharacters && (
          <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Characters</div>
            <div className="mt-1 text-sm font-medium text-slate-700">
              {selectedCharacters.length} {selectedCharacters.length === 1 ? 'character' : 'characters'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedCharacters.map(char => char.split(' ')[0]).join(', ')}
            </div>
          </div>
        )}
      </div>
      
      {/* --- Overlays: Insights & Tools --- */}
      <div className="absolute top-6 right-6 bottom-6 z-50 flex flex-col gap-4">
        {/* Card 1: Credits & Tokens */}
        <div className="w-72 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                🪙
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Credits</h3>
                <p className="text-xs text-slate-500">Token management</p>
              </div>
            </div>
            <button
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              type="button"
            >
              Refill
            </button>
          </div>

          <div className="space-y-4 text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Available tokens</span>
                <span className="text-base font-semibold text-slate-800">1,247</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Ready for motion generation</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-slate-500">Motion generations</span>
                <span className="text-base font-semibold text-slate-800">~24 remaining</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Based on current usage</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Usage progress</span>
                <span className="font-medium text-slate-700">78%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: '78%' }}></div>
              </div>
            </div>

            <div className="flex justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <span>Used: 342 tokens</span>
              <span>Total: 1,589 tokens</span>
            </div>
          </div>
        </div>

        {/* Card 2: Motion Chatbot */}
        <div className="w-72 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-lg backdrop-blur">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                🤖
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Motion AI</h3>
                <p className="text-xs text-slate-500">Generate animations</p>
              </div>
            </div>
          </div>
          {onFileReceived && onSend && onAvatarUpdate && (
            <div className="px-4 py-4">
              <Chatbot
                onFileReceived={onFileReceived}
                onSend={onSend}
                onAvatarUpdate={onAvatarUpdate}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Canvas = React.memo(CanvasComponent);

// m_avg_* (target) -> source bone name (your BVH/FBX rig)
const targetToSourceName = {
  // root / pelvis
  m_avg_root:   "Hips",     // if your pipeline wants a root driver
  m_avg_Pelvis: "Hips",

  // spine (note your source has Spine, Spine1, Spine2)
  m_avg_Spine1: "Spine",
  m_avg_Spine2: "Spine1",
  m_avg_Spine3: "Spine2",
  m_avg_Neck:   "Neck",
  m_avg_Head:   "Head",

  // left leg
  m_avg_L_Hip:   "LeftUpLeg",
  m_avg_L_Knee:  "LeftLeg",
  m_avg_L_Ankle: "LeftFoot",
  m_avg_L_Foot:  "LeftToe",     // closest match; target has no explicit toe base

  // right leg
  m_avg_R_Hip:   "RightUpLeg",
  m_avg_R_Knee:  "RightLeg",
  m_avg_R_Ankle: "RightFoot",
  m_avg_R_Foot:  "RightToe",

  // left arm (your target has a Collar bone, source does not)
  m_avg_L_Collar:   "LeftShoulder",
  m_avg_L_Shoulder: "LeftArm",
  m_avg_L_Elbow:    "LeftForeArm",
  m_avg_L_Wrist:    "LeftHand",
  m_avg_L_Hand:     "LeftHand", // extra hand node → reuse wrist driver

  // right arm
  m_avg_R_Collar:   "RightShoulder",
  m_avg_R_Shoulder: "RightArm",
  m_avg_R_Elbow:    "RightForeArm",
  m_avg_R_Wrist:    "RightHand",
  m_avg_R_Hand:     "RightHand"
};

// in retargetOptions



export default Canvas;

// Helper functions remain the same
function getSource(sourceModel: any) {
  console.log('Source model:', sourceModel);
  const skeleton: THREE.Skeleton | undefined = sourceModel.skeleton;
  const clip: THREE.AnimationClip = sourceModel.clip;
  const rootBone = skeleton?.bones?.[0];
  if (!skeleton || !rootBone) {
    throw new Error("BVH source skeleton is missing bones.");
  }
  if (rootBone) {
    skeleton.pose();
  }
  const mixer = new THREE.AnimationMixer(rootBone);
  mixer.clipAction(clip).play();
  return { clip, skeleton, mixer };
}

function getTargetSkin(targetModel: any, characterName: string) {

  const targetSkin = mixamo_targets.find(target => target.charactername == characterName);
  console.log('Target skin:', targetSkin?.targetskin);
  let candidate = targetSkin ? targetModel.scene.children[targetSkin.targetskin] : undefined;
  if (!candidate) {
    targetModel.scene.traverse((child: any) => {
      if (!candidate && child.isSkinnedMesh) {
        candidate = child;
      }
    });
  }
  return candidate;
}



// Retargeting function for Mixamo characters (FBX files)
function retargetMixamoModel(source: any, targetModel: any, characterName: string): RetargetResult | null {
  const targetScene = targetModel.scene || targetModel;
  const rig = findPrimaryMixamoRig(targetScene);
  console.log('Rig:', rig);


  let targetSkin: any = getTargetSkin(targetModel, characterName);
  

  // // Find the SkinnedMesh in the target model
  // targetModel.scene.traverse((child: any) => {
  //   if (!targetSkin && child.isSkinnedMesh) {
  //     targetSkin = child;
  //   }
  // });
  
  if (!targetSkin) {
    console.warn('No SkinnedMesh found for Mixamo target model');
    return null;
  }

  console.log('Retargeting Mixamo model:', targetModel);
  
 
  const retargetOptions = {
    hip: 'Hips',
    getBoneName: function (bone: any) {
      if (targetModel.scene.userData.modelName == "basic.fbx") {
        return targetToSourceName[bone.name as keyof typeof targetToSourceName] || bone.name;
      }
      return bone.name.replace(/^mixamorig/, '');
    },
    // getBoneName: (bone: any) => targetToSourceName[bone.name as keyof typeof targetToSourceName] || bone.name,
    rotationOrder: "ZYX",
    preserveHipPosition: true,
    useTargetMatrix: true,
    scale: targetModel.scene.userData.modelName == "basic.fbx" ? 1 : 100,
    // localOffsets: {
    //   'mixamorigLeftUpLeg': rotateCW180,
    //   'mixamorigRightUpLeg': rotateCW180,
    //   'mixamorigLeftLeg': rotateCW180,
    //   'mixamorigRightLeg': rotateCW180,
    //   'mixamorigLeftFoot': rotateFoot,
    //   'mixamorigRightFoot': rotateFoot,
    //   'mixamorigRightShoulder': rotateRightShoulder,
    //   'mixamorigLeftShoulder': rotateLeftShoulder,
    //   'mixamorigRightArm': rotateRightArm,
    //   'mixamorigLeftArm': rotateLeftArm,
    //   'mixamorigRightForeArm': rotateRightForeArm,
    //   'mixamorigLeftForeArm': rotateLeftForeArm,
    //   'mixamorigLeftHand': rotateLeftHand,
    //   'mixamorigRightHand': rotateRightHand,
    // },
  };

  const sourceSkeleton: THREE.Skeleton | undefined = source?.skeleton;

  if (sourceSkeleton && targetSkin?.isSkinnedMesh) {
    const cacheKey = `${characterName || targetSkin.uuid}:${sourceSkeleton.uuid}`;
    let localOffsets = mixamoOffsetCache.get(cacheKey);

    if (!localOffsets || Object.keys(localOffsets).length === 0) {
      localOffsets = computeLocalOffsets(targetSkin, sourceSkeleton, {
        getBoneName: retargetOptions.getBoneName,
        names: retargetOptions.names,
      });

      if (localOffsets && Object.keys(localOffsets).length > 0) {
        mixamoOffsetCache.set(cacheKey, localOffsets);
      }
    }

    if (localOffsets && Object.keys(localOffsets).length > 0) {
      retargetOptions.localOffsets = localOffsets;
    }
  }
  
  

  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, retargetOptions);
  console.log('Mixamo retargetedClip:', retargetedClip);

  if (!retargetedClip || retargetedClip.tracks.length === 0) {
    console.error('Mixamo retargeting did not produce animation tracks.');
    return null;
  }
  
  const FOOT_RX = /Foot$|ToeBase$/i;
  retargetedClip.tracks = retargetedClip.tracks.map(track => {
    if (/\.position\./.test(track.name) && FOOT_RX.test(track.name)) {
      // zero out Y movement of feet
      const values = (track as THREE.VectorKeyframeTrack).values.slice();
      for (let i = 1; i < values.length; i += 3) values[i] = 0;
      return new THREE.VectorKeyframeTrack(track.name, (track as any).times, Array.from(values));
    }
    return track;
  });
  const mixamoTarget = mixamo_targets.find(target => target.charactername == characterName);
  const baseScale = typeof targetScene.userData?.normalizedScale === "number" ? targetScene.userData.normalizedScale : 1;
  const scaleMultiplier = typeof targetScene.userData?.originalHeight === "number" ? targetScene.userData.originalHeight : 1;

  targetModel.scene.scale.setScalar(targetModel.scene.userData.modelName == "basic.fbx" ? 1 : baseScale/30);
  targetScene.updateMatrixWorld(true);

  const mixamoOffset = mixamoTarget?.yoffset || 0;
  const bbox = new THREE.Box3().setFromObject(targetScene);
  const groundOffset = -bbox.min.y;
  targetScene.userData.groundOffset = groundOffset;
  targetScene.position.y = groundOffset + mixamoOffset;

  const mixer = new THREE.AnimationMixer(targetSkin);
  mixer.clipAction(retargetedClip).play();

  return { mixer, clip: retargetedClip };
}

// Retargeting function for custom characters (GLB files)
function retargetCustomModel(source: any, targetModel: any): RetargetResult | null {
  let targetSkin: any = null;
  
  // Find the SkinnedMesh in the target model
  targetModel.scene.traverse((child: any) => {
    if (!targetSkin && child.isSkinnedMesh) {
      targetSkin = child;
    }
  });
  
  if (!targetSkin) {
    console.warn('No SkinnedMesh found for custom target model');
    return null;
  }
  
  console.log('Retargeting custom model:', targetModel.name);
  


  const retargetOptions = {
    hip: 'Hips',
    scale: 0.4,
    getBoneName: function (bone: any) {
    
      return bone.name;
    }
  };
  
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, retargetOptions);
  console.log('Custom retargetedClip:', retargetedClip);
  console.log('Custom retargetedClip tracks:', retargetedClip.tracks.length);
  console.log('Custom retargetedClip duration:', retargetedClip.duration);
  
  // If retargeting failed, try without retargeting options
  if (retargetedClip.tracks.length === 0) {
    console.log('Custom retargeting failed, trying without options...');
    const fallbackClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip);
    console.log('Custom fallback clip:', fallbackClip);
    if (fallbackClip.tracks.length > 0) {
      const mixer = new THREE.AnimationMixer(targetSkin);
      mixer.clipAction(fallbackClip).play();
      return { mixer, clip: fallbackClip };
    }
  }
  
  const mixer = new THREE.AnimationMixer(targetSkin);
  
  // Only play if we have tracks
  if (retargetedClip.tracks.length > 0) {
    mixer.clipAction(retargetedClip).play();
    return { mixer, clip: retargetedClip };
  } else {
    console.error('No animation tracks found after custom retargeting!');
    return null;
  }
}

// Main retargeting function that determines which method to use
function retargetModel(source: any, targetModel: any, isMixamo: boolean = false , characterName: string): RetargetResult | null {
  if (isMixamo) {
    return retargetMixamoModel(source, targetModel, characterName);
  } else {
    return retargetCustomModel(source, targetModel);
  }
}
