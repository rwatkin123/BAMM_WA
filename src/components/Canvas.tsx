import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BVHLoader } from "three/addons/loaders/BVHLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Slider } from "./ui/slider";
import create_glb from "./create_glb";
import Chatbot from "./Chatbot";
import { useCharacterControls } from "@/contexts/CharacterControlsContext";

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
  const [trimRange, setTrimRange] = useState([0, 0]);
  const trimRangeRef = useRef<[number, number]>(trimRange);
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
      setTrimRange([0, duration]);
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    let mixers: THREE.AnimationMixer[] = [];
    modelsRef.current = [];
    // Remove old skeleton helpers
    skeletonHelpersRef.current.forEach(helper => scene.remove(helper));
    skeletonHelpersRef.current = [];
    async function setupModels() {
      const loader = new GLTFLoader();
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
        // MULTIPLE CHARACTERS SELECTED: Generate each character
        setLoadingCharacters(true);
        
        for (let i = 0; i < selectedCharacters.length; i++) {
          const characterName = selectedCharacters[i];
          const position = getCharacterPosition(i, selectedCharacters.length);

          try {
            console.log(`Loading character ${i + 1}/${selectedCharacters.length}: ${characterName}`);
            
            // Generate character GLB
            await create_glb(characterName);
            // Small delay to ensure file is written
            await new Promise(resolve => setTimeout(resolve, 500));

            // Load the generated character
            const targetModel: any = await new Promise((resolve, reject) => {
              loader.load(`/mesh/mesh.glb?t=${Date.now()}&char=${i}`, resolve, undefined, reject);
            });

            scene.add(targetModel.scene);
            modelsRef.current.push(targetModel.scene);


            targetModel.scene.traverse((child: any) => {
              if (child.isSkinnedMesh) {
                child.skeleton.pose();
                child.updateMatrixWorld(true);
              }
            });

            // 🔧 NEW: Normalize character scale BEFORE positioning
            const { scaleFactor } = normalizeCharacterScale(targetModel, 2.0);
            console.log(`Character ${i + 1} (${characterName}) scaled by: ${scaleFactor.toFixed(3)}`);

            // NOW position the normalized character
            targetModel.scene.position.x += position[0];
            targetModel.scene.position.z += position[2];
            // Y position is already set by normalizeCharacterScale

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
            const mixer = retargetModel(source, targetModel);
            return mixer;
          });

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

//      function animate() {
  //      const delta = clock.getDelta();
        
        // Only update mixers if playing
    //    if (mixers.length > 0 && isPlayingRef.current) {
      //    const currentTime = mixers[0]?.time || 0;
          
        //  if (currentTime >= trimRange[1]) {
          //  mixers.forEach(mixer => mixer.setTime(trimRange[1]));
            //if (audioRef.current) audioRef.current.currentTime = trimRange[1];
            //mixers.forEach(mixer => mixer.timeScale = 0);
            //if (audioRef.current) audioRef.current.pause();
            //setIsPlaying(false);
          //} else {
            //mixers.forEach(mixer => mixer.update(delta));
            //setProgress(currentTime);
          //}
        //}
        
        //controls.update();
        //renderer.render(scene, camera);
      //}

      //renderer.setAnimationLoop(animate);
    }

    setupModels();

        // ONE animation/render loop for the whole scene:
        renderer.setAnimationLoop(() => {
          const delta = clock.getDelta();
    
          if (mixersRef.current.length && isPlayingRef.current) {
            const currentTime = mixersRef.current[0].time;
    
            if (currentTime >= trimRangeRef.current[1]) {
              // Hit trim-end → stop
              mixersRef.current.forEach(m => m.setTime(trimRangeRef.current[1]));
              if (audioRef.current) audioRef.current.pause();
             // if (onPlayStateChange) onPlayStateChange(false);
              //setInternalIsPlaying(false);
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
    setTrimRange(newRange);
    let currentProgress = progress;
    
    if (currentProgress < newRange[0]) currentProgress = newRange[0];
    if (currentProgress > newRange[1]) currentProgress = newRange[1];
    
    const mixers = mixersRef.current;
    mixers.forEach(mixer => mixer.setTime(currentProgress));
    if (audioRef.current) audioRef.current.currentTime = currentProgress;
    setProgress(currentProgress);
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div ref={sceneRef} className="h-full bg-gray-100" />
      
      {/* Character loading indicator */}
      {loadingCharacters && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm animate-pulse">
          Loading {selectedCharacters.length} Characters...
        </div>
      )}
      
      {/* Character count indicator */}
      {selectedCharacters.length > 0 && !loadingCharacters && (
        <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
          {selectedCharacters.length} Character{selectedCharacters.length > 1 ? 's' : ''}: {selectedCharacters.map(char => char.split(' ')[0]).join(', ')}
        </div>
      )}
      
      {/* Play Controls Card - Bottom Left (moved from dashboard) */}
      <div className="absolute bottom-6 left-6 w-80 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 p-4 z-50">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 5v10l8-5-8-5z"/>
            </svg>
            Motion
          </h3>
          <div className="text-xs text-gray-500 font-mono">
            {progress.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
        </div>
        {/* Compact Controls Row */}
        <div className="flex items-center gap-3">
          {/* Circular Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={loadingCharacters}
            className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md
              ${loadingCharacters 
                ? 'bg-gray-200 cursor-not-allowed' 
                : isPlaying
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4h4v12H6V4zm4 0h4v12h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 5v10l8-5-8-5z"/>
              </svg>
            )}
          </button>
          {/* Progress Bar as Slider */}
          <div className="flex-1">
            <Slider
              min={trimRange[0]}
              max={trimRange[1] || duration}
              step={0.01}
              value={[progress]}
              onValueChange={([val]) => handleSeek(val)}
              disabled={loadingCharacters || duration === 0}
            />
          </div>
          {/* Character Count */}
          {selectedCharacters.length > 1 && (
            <div className="text-xs text-blue-600 font-medium">
              {selectedCharacters.length} chars
            </div>
          )}
        </div>
      </div>
      
      {/* --- Smart Card Container --- */}
      <div className="absolute top-6 right-6 bottom-6 flex flex-col gap-3 z-50">
        {/* Card 1: Credits & Tokens */}
        <div className="w-80 bg-white/60 shadow-2xl border border-gray-100 rounded-2xl px-8 py-4 backdrop-blur-lg transition-all duration-300 hover:shadow-2xl" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🪙</span>
              <span className="font-semibold text-sm text-gray-800">Credits</span>
            </div>
            <button className="flex items-center gap-1 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-medium transition-colors">
              <span className="text-sm">🪙</span>
              Refill
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Token Balance */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Available Tokens</span>
              <span className="text-sm font-semibold text-gray-800">1,247</span>
            </div>
            
            {/* Motion Generation Capacity */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Motion Generations</span>
              <span className="text-sm font-semibold text-blue-600">~24 remaining</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: '78%' }}
              ></div>
            </div>
            
            {/* Usage Stats */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Used: 342 tokens</span>
              <span>Total: 1,589 tokens</span>
            </div>
          </div>
        </div>

        {/* Card 3: Character Mode Toggle */}
        <div className="w-80 bg-white/60 shadow-2xl border border-gray-100 rounded-2xl px-8 py-4 backdrop-blur-lg transition-all duration-300 hover:shadow-2xl" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <span className="font-semibold text-sm text-gray-800">Character Mode</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <button
              onClick={() => onMultiCharacterModeChange && onMultiCharacterModeChange(!multiCharacterMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-md transition-all text-sm font-medium
                ${multiCharacterMode 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                }`}
            >
              {multiCharacterMode ? (
                <>
                  <span className="text-base">👥</span>
                  Multi Character
                </>
              ) : (
                <>
                  <span className="text-base">👤</span>
                  Single Character
                </>
              )}
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            {multiCharacterMode 
              ? "Select multiple characters to animate together" 
              : "Select one character at a time"
            }
          </div>
        </div>

        {/* Card 3: Motion Chatbot - Flex to align bottom with play card */}
        <div className="w-80 flex-1 bg-white/60 shadow-2xl border border-gray-100 rounded-2xl backdrop-blur-lg transition-all duration-300 hover:shadow-2xl overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)' }}>
          {onFileReceived && onSend && onAvatarUpdate && (
            <Chatbot
              onFileReceived={onFileReceived}
              onSend={onSend}
              onAvatarUpdate={onAvatarUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions remain the same
function getSource(sourceModel: any) {
  const clip = sourceModel.clip;
  const helper = new THREE.SkeletonHelper(sourceModel.skeleton.bones[0]);
  const skeleton = new THREE.Skeleton(helper.bones);
  const mixer = new THREE.AnimationMixer(sourceModel.skeleton.bones[0]);
  mixer.clipAction(sourceModel.clip).play();
  return { clip, skeleton, mixer };
}

function retargetModel(source: any, targetModel: any) {
  const targetSkin = targetModel.scene.children[0];
  const retargetedClip = SkeletonUtils.retargetClip(targetSkin, source.skeleton, source.clip, {
    hip: 'Hips',
    getBoneName: function (bone: any) {
      return bone.name;
    }
  });
  const mixer = new THREE.AnimationMixer(targetSkin);
  retargetedClip.tracks.forEach((track: any) => {
    if (track.name.includes('Hips') && track.name.endsWith('.position')) {
      const values = track.values.slice();
      const firstY = values[1];
      for (let i = 1; i < values.length; i += 3) {
        values[i] -= firstY;
      }
      track.values = values;
    }
  });
  mixer.clipAction(retargetedClip).play();
  return mixer;
}