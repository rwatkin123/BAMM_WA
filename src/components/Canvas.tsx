import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Slider } from "./ui/slider";
import create_glb from "./create_glb";
import Chatbot from "./Chatbot";
import { useCharacterControls } from "@/contexts/CharacterControlsContext";
import mixamo_targets from "@/lib/mixamo_targets.json";
import { findPrimaryMixamoRig } from "@/lib/getSkin";
interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
  selectedCharacters: string[];
  onProgressChange?: (progress: number) => void;
  onDurationChange?: (duration: number) => void;
  onTrimRangeChange?: (trimRange: number[]) => void;
  multiCharacterMode?: boolean;
  onMultiCharacterModeChange?: (mode: boolean) => void;
  onFileReceived?: (filename: string) => void;
  onSend?: () => void;
  onAvatarUpdate?: () => void;
}

export default function Canvas({ 
  bvhFile, 
  trigger, 
  selectedCharacters = [],
  onProgressChange,
  onDurationChange,
  onTrimRangeChange,
  multiCharacterMode,
  onMultiCharacterModeChange,
  onFileReceived,
  onSend,
  onAvatarUpdate
}: CanvasProps) {

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
  const modelsRef = useRef<any[]>([]);
  // Store skeleton helpers
  const skeletonHelpersRef = useRef<any[]>([]);
  // Store reference to THREE.js scene
  const sceneRef_three = useRef<THREE.Scene | null>(null);

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
    model.scene.position.y = -newBox.min.y;
    
    return { scaleFactor, newBox };
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

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
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
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (sceneRef.current.firstChild) {
      sceneRef.current.removeChild(sceneRef.current.firstChild);
    }
    sceneRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0;
    controls.maxDistance = 1200;
    controls.minPolarAngle = 0; // Prevent going below the grid (0 = horizontal)
    controls.maxPolarAngle = Math.PI / 2; // Allow full 180 degree view above
    controls.target.set(0, 1, 0);

    // Enhanced lighting setup for better model visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Add hemisphere light for more natural lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0xffffff, 0.4);
    scene.add(hemisphereLight);

    // Add directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight.position.set(-10, 5, 10);
    scene.add(pointLight);

    // Add another point light from the opposite side
    const pointLight2 = new THREE.PointLight(0xffffff, 0.3, 100);
    pointLight2.position.set(10, 5, -10);
    scene.add(pointLight2);

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

      if (selectedCharacters.length === 0) {
        // NO CHARACTERS SELECTED: Show default mesh.glb
        try {
          const targetModel: any = await new Promise((resolve, reject) => {
            loader.load('/mesh/mesh.glb', resolve, undefined, reject);
          });

          scene.add(targetModel.scene);
          modelsRef.current = [targetModel.scene];


          targetModel.scene.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              child.skeleton.pose();
              child.updateMatrixWorld(true);
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // 🔧 NEW: Normalize default character scale
          normalizeCharacterScale(targetModel);

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
          const characterName = selectedCharacters[i];
          const position = getCharacterPosition(i, selectedCharacters.length);

          try {
            console.log(`Loading character ${i + 1}/${selectedCharacters.length}: ${characterName}`);
            let targetModel: any;
            if (characterName.toLowerCase().endsWith('.fbx') || characterName.includes('/mixamo/')) {
              // Load FBX model directly (Mixamo)
              const fbx: any = await new Promise((resolve, reject) => {
                fbxLoader.load(characterName, resolve, undefined, reject);
              });
              targetModel = {scene: fbx};
            } else {
              // Custom: Generate and load GLB
              await create_glb(characterName);
              await new Promise(resolve => setTimeout(resolve, 500));
              targetModel = await new Promise((resolve, reject) => {
                loader.load(`/mesh/mesh.glb?t=${Date.now()}&char=${i}`, resolve, undefined, reject);
              });
            }

            scene.add(targetModel.scene);
            modelsRef.current.push(targetModel.scene);

            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                child.skeleton.pose();
                child.updateMatrixWorld(true);
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const { scaleFactor } = normalizeCharacterScale(targetModel, 2.0);
            console.log(`Character ${i + 1} (${characterName}) scaled by: ${scaleFactor.toFixed(3)}`);

            targetModel.scene.position.x += position[0];
            targetModel.scene.position.z += position[2];
            
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
            console.error(`Failed to load character ${characterName}:`, error);
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
          
          // Create mixer for each character
          mixers = targetModels.map((targetModel, index) => {
            console.log(`Applying motion to character ${index + 1}`);
            // Determine if this is a Mixamo character based on the character name
            console.log(selectedCharacters)
            const characterName = selectedCharacters[index] || '';
            const isMixamo = characterName ? (characterName.toLowerCase().endsWith('.fbx') || characterName.includes('/mixamo/')) : false;
            const mixer = retargetModel(source, targetModel, isMixamo , characterName);
            isMixamo ? normalizeCharacterScale(targetModel, 0.0011) : null;
            return mixer;
          }).filter((mixer): mixer is THREE.AnimationMixer => mixer !== null);

          // targetModels.forEach(model => {
          //   model.scene.position.x += 10
          // });

          mixersRef.current = mixers;
          setDuration(source.clip.duration);

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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("resize", onWindowResize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      mixers.forEach(mixer => mixer.stopAllAction());
    };
  }, [selectedCharacters, bvhFile, trigger, showSkeleton]);

  // Update scale, rotation, and skinning options when controls change (RESTORED: Original working code)
  useEffect(() => {
    modelsRef.current.forEach(model => {
      if (model) {
        model.scale.setScalar(characterScale);
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
  const handlePlayPause = () => {
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
    setIsPlaying(!isPlaying);
    console.log("Play state changed to:", !isPlaying);
  };

  const handleSeek = (newTime: number) => {
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
  };

  const handleTrimRangeChange = (newRange: number[]) => {
    setTrimRange([newRange[0], newRange[1]] as [number, number]);
    let currentProgress = progress;
    
    if (currentProgress < newRange[0]) currentProgress = newRange[0];
    if (currentProgress > newRange[1]) currentProgress = newRange[1];
    
    const mixers = mixersRef.current;
    mixers.forEach(mixer => mixer.setTime(currentProgress));
    if (audioRef.current) audioRef.current.currentTime = currentProgress;
    setProgress(currentProgress);
  };

  return (
    <div style={{ position: "relative", height: "100%" }} className="bg-gradient-to-br from-slate-50 to-slate-100">
      <div ref={sceneRef} className="h-full" />
      
      {/* Character loading indicator */}
      {loadingCharacters && (
        <div className="absolute top-6 left-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm border border-blue-500/20 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <span>Loading {selectedCharacters.length} Character{selectedCharacters.length > 1 ? 's' : ''}...</span>
          </div>
        </div>
      )}
      
      {/* Character count indicator */}
      {selectedCharacters.length > 0 && !loadingCharacters && (
        <div className="absolute top-6 left-6 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>{selectedCharacters.length} Character{selectedCharacters.length > 1 ? 's' : ''}: {selectedCharacters.map(char => char.split(' ')[0]).join(', ')}</span>
          </div>
        </div>
      )}
      
      {/* Play Controls Card - Bottom Left */}
      <div className="absolute bottom-6 left-6 w-96 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 z-50" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
        {/* Professional Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 5v10l8-5-8-5z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Motion Controller</h3>
              <p className="text-xs text-gray-500">Animation playback controls</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-gray-700 font-medium">
              {progress.toFixed(1)}s / {duration.toFixed(1)}s
            </div>
            <div className="text-xs text-gray-500">
              {duration > 0 ? `${((progress / duration) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
        </div>
        
        {/* Enhanced Controls Row */}
        <div className="flex items-center gap-4">
          {/* Professional Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={loadingCharacters}
            className={`w-14 h-14 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
              ${loadingCharacters 
                ? 'bg-gray-200 cursor-not-allowed text-gray-400' 
                : isPlaying
                  ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-500/25'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/25'
              }`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4h4v12H6V4zm4 0h4v12h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 5v10l8-5-8-5z"/>
              </svg>
            )}
          </button>
          
          {/* Enhanced Progress Bar */}
          <div className="flex-1">
            <div className="mb-2">
              <Slider
                min={trimRange[0]}
                max={trimRange[1] || duration}
                step={0.01}
                value={[progress]}
                onValueChange={([val]) => handleSeek(val)}
                disabled={loadingCharacters || duration === 0}
                className="[&_.slider-track]:bg-gradient-to-r [&_.slider-track]:from-blue-200 [&_.slider-track]:to-blue-300 [&_.slider-thumb]:bg-blue-600 [&_.slider-thumb]:border-blue-700"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{trimRange[0].toFixed(1)}s</span>
              <span>{trimRange[1].toFixed(1)}s</span>
            </div>
          </div>
          
          {/* Character Count Badge */}
          {selectedCharacters.length > 1 && (
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-lg">
              {selectedCharacters.length} chars
            </div>
          )}
        </div>
      </div>
      
      {/* --- Professional Card Container --- */}
      <div className="absolute top-6 right-6 bottom-6 flex flex-col gap-4 z-50">
        {/* Card 1: Credits & Tokens */}
        <div className="w-80 bg-white/80 backdrop-blur-xl shadow-2xl border border-white/20 rounded-2xl px-6 py-5 transition-all duration-300 hover:shadow-2xl hover:bg-white/90" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-sm">🪙</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-800">Credits</h3>
                <p className="text-xs text-gray-500">Token management</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg text-xs font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
              <span className="text-sm">🪙</span>
              Refill
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Token Balance */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-600">Available Tokens</span>
                <span className="text-lg font-bold text-gray-800">1,247</span>
              </div>
              <div className="text-xs text-gray-500">Ready for motion generation</div>
            </div>
            
            {/* Motion Generation Capacity */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-600">Motion Generations</span>
                <span className="text-lg font-bold text-blue-600">~24 remaining</span>
              </div>
              <div className="text-xs text-gray-500">Based on current usage</div>
            </div>
            
            {/* Enhanced Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Usage Progress</span>
                <span>78%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: '78%' }}
                ></div>
              </div>
            </div>
            
            {/* Usage Stats */}
            <div className="flex justify-between text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              <span>Used: 342 tokens</span>
              <span>Total: 1,589 tokens</span>
            </div>
          </div>
        </div>

        {/* Card 2: Character Mode Toggle */}
        <div className="w-80 bg-white/80 backdrop-blur-xl shadow-2xl border border-white/20 rounded-2xl px-6 py-5 transition-all duration-300 hover:shadow-2xl hover:bg-white/90" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-sm">👥</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-800">Character Mode</h3>
                <p className="text-xs text-gray-500">Animation configuration</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center mb-4">
            <button
              onClick={() => onMultiCharacterModeChange && onMultiCharacterModeChange(!multiCharacterMode)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg transition-all duration-300 text-sm font-semibold transform hover:scale-105 active:scale-95
                ${multiCharacterMode 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/25' 
                  : 'bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 border border-gray-300 shadow-gray-500/10'
                }`}
            >
              {multiCharacterMode ? (
                <>
                  <span className="text-lg">👥</span>
                  Multi Character
                </>
              ) : (
                <>
                  <span className="text-lg">👤</span>
                  Single Character
                </>
              )}
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-3">
            <div className="text-xs text-gray-600 text-center font-medium">
              {multiCharacterMode 
                ? "Select multiple characters to animate together" 
                : "Select one character at a time"
              }
            </div>
          </div>
        </div>

        {/* Card 3: Motion Chatbot */}
        <div className="w-80 flex-1 bg-white/80 backdrop-blur-xl shadow-2xl border border-white/20 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:bg-white/90 overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-sm">🤖</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-gray-800">Motion AI</h3>
                <p className="text-xs text-gray-500">Generate animations</p>
              </div>
            </div>
          </div>
          {onFileReceived && onSend && onAvatarUpdate && (
            <div className="px-3 pb-3">
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
}

// Helper functions remain the same
function getSource(sourceModel: any) {
  console.log('Source model:', sourceModel);
  const clip = sourceModel.clip;
  const helper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
  const skeleton = new THREE.Skeleton(helper.bones);
  const mixer = new THREE.AnimationMixer(sourceModel.skeleton.bones[0]);
  mixer.clipAction(sourceModel.clip).play();
  return { clip, skeleton, mixer };
}

function getTargetSkin(targetModel: any, characterName: string) {
  console.log('characterName:', characterName);
  console.log('mixamo_targets:', mixamo_targets);
  const targetSkin = mixamo_targets.find(target => target.charactername == characterName);
  console.log('Target skin:', targetSkin?.targetskin);
  return targetModel.scene.children[targetSkin?.targetskin || 0];
}



// Retargeting function for Mixamo characters (FBX files)
function retargetMixamoModel(source: any, targetModel: any, characterName: string) {
  const rig = findPrimaryMixamoRig(targetModel.scene|| targetModel);
  console.log('Rig:', rig);

  
  let targetSkin: any = getTargetSkin(targetModel, characterName);


  // Find the SkinnedMesh in the target model
  targetModel.scene.traverse((child: any) => {
    if (!targetSkin && child.isSkinnedMesh) {
      targetSkin = child;
    }
  });
  
  if (!targetSkin) {
    console.warn('No SkinnedMesh found for Mixamo target model');
    return null;
  }
  
  console.log('Retargeting Mixamo model:', targetModel);
  
  // Mixamo-specific rotation matrices for proper bone alignment
  const rotateCW180 = new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(180));
  const rotateFoot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(-65), 
    THREE.MathUtils.degToRad(0), 
    THREE.MathUtils.degToRad(180)
  ));
  const rotateRightArm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(112), 
    THREE.MathUtils.degToRad(-10), 
    THREE.MathUtils.degToRad(90)
  ));
  const rotateRightForeArm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(99), 
    THREE.MathUtils.degToRad(-3), 
    THREE.MathUtils.degToRad(73)
  ));
  const rotateLeftArm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(104), 
    THREE.MathUtils.degToRad(20), 
    THREE.MathUtils.degToRad(-73)
  ));
  const rotateLeftForeArm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(68), 
    THREE.MathUtils.degToRad(-7), 
    THREE.MathUtils.degToRad(-82)
  ));
  const rotateLeftShoulder = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(90), 
    THREE.MathUtils.degToRad(-11), 
    THREE.MathUtils.degToRad(-82)
  ));
  const rotateRightShoulder = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(100), 
    THREE.MathUtils.degToRad(-3), 
    THREE.MathUtils.degToRad(73)
  ));
  const rotateLeftHand = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(0), 
    THREE.MathUtils.degToRad(0), 
    THREE.MathUtils.degToRad(-90)
  ));
  const rotateRightHand = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(0), 
    THREE.MathUtils.degToRad(0), 
    THREE.MathUtils.degToRad(90)
  ));

  const retargetOptions = {
    hip: 'Hips',
    getBoneName: function (bone: any) {
      return bone.name.replace(/^mixamorig/, '');
    },
    rotationOrder: "ZYX", 
    preserveHipPosition: true, 
    useTargetMatrix: true,
    scale: 142,
    localOffsets: {
      'mixamorigLeftUpLeg': rotateCW180,
      'mixamorigRightUpLeg': rotateCW180,
      'mixamorigLeftLeg': rotateCW180,
      'mixamorigRightLeg': rotateCW180,
      'mixamorigLeftFoot': rotateFoot,
      'mixamorigRightFoot': rotateFoot,
      'mixamorigRightShoulder': rotateRightShoulder,
      'mixamorigLeftShoulder': rotateLeftShoulder,
      'mixamorigRightArm': rotateRightArm,
      'mixamorigLeftArm': rotateLeftArm,
      'mixamorigRightForeArm': rotateRightForeArm,
      'mixamorigLeftForeArm': rotateLeftForeArm,
      'mixamorigLeftHand': rotateLeftHand,
      'mixamorigRightHand': rotateRightHand,
    },
  };
  
  // Scale the target model for Mixamo
  // targetModel.scene.scale.setScalar(0.011);
  
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, retargetOptions);
  console.log('Mixamo retargetedClip:', retargetedClip);
  
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

  const mixer = new THREE.AnimationMixer(targetSkin);
  mixer.clipAction(retargetedClip).play();
  return mixer;
}

// Retargeting function for custom characters (GLB files)
function retargetCustomModel(source: any, targetModel: any) {
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
      return mixer;
    }
  }
  
  const mixer = new THREE.AnimationMixer(targetSkin);
  
  // Only play if we have tracks
  if (retargetedClip.tracks.length > 0) {
    mixer.clipAction(retargetedClip).play();
  } else {
    console.error('No animation tracks found after custom retargeting!');
  }
  
  return mixer;
}

// Main retargeting function that determines which method to use
function retargetModel(source: any, targetModel: any, isMixamo: boolean = false , characterName: string) {
  if (isMixamo) {
    return retargetMixamoModel(source, targetModel, characterName);
  } else {
    return retargetCustomModel(source, targetModel);
  }
}